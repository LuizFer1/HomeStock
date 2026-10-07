import type { CheckoutReceipt } from "../../data/repository";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { type ListExtra, normalizeExtraName } from "../../domain/model/list-extra";
import {
  checkedEntries,
  liveMarkOf,
  type ShoppingEntry,
  type ShoppingList,
} from "../../domain/projections/shopping";
import { foldText } from "../../domain/text/fold-text";
import type { Session } from "../session/session";

/** Comandos da lista de compras para as telas. */
export interface ShoppingStore {
  /** Fila serial: inverte a marca lida no banco. */
  toggle: (entry: Pick<ShoppingEntry, "kind" | "id">) => Promise<void>;
  /** Quantidade e preco da linha; qty igual a `entry.suggestion` grava null. */
  adjust: (entry: ShoppingEntry, qty: number, priceMinor: number | null) => Promise<void>;
  /** Recusa nome repetido: "{nome} já está na lista." */
  addExtra: (name: string) => Promise<ListExtra>;
  removeExtra: (id: Ulid) => Promise<void>;
  restoreExtra: (id: Ulid) => Promise<void>;
  pin: (itemId: Ulid) => Promise<void>;
  unpin: (itemId: Ulid) => Promise<void>;
  restorePin: (itemId: Ulid) => Promise<void>;
  /**
   * Desfaz o "entrou na lista": com marca anterior so solta a fixacao (as anotacoes ficam),
   * sem marca anterior apaga. Marca que ja saiu da lista nao e erro: nada a desfazer.
   */
  undoPin: (itemId: Ulid, hadMark: boolean) => Promise<void>;
  checkout: (list: ShoppingList) => Promise<CheckoutReceipt>;
  undoCheckout: (receipt: CheckoutReceipt) => Promise<void>;
}

export function createShoppingStore(session: Session): ShoppingStore {
  // Cada toque conta, mas um por vez: dois toques seguidos nao podem ler o mesmo valor.
  let queue: Promise<unknown> = Promise.resolve();
  // Tudo que mexe numa marca ou num pedido passa por aqui: a ordem dos toques e a ordem no banco.
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work);
    // A falha volta para quem tocou; a fila segue para o proximo.
    queue = next.catch(() => {});
    return next;
  }

  return {
    toggle(entry) {
      return enqueue(() =>
        session.run(async (repo) => {
          if (entry.kind === "item") await repo.toggleItemMark(entry.id);
          else await repo.toggleListExtra(entry.id);
        }),
      );
    },
    adjust(entry, qty, priceMinor) {
      const stored = qty === entry.suggestion ? null : qty;
      return enqueue(() =>
        session.run(async (repo) => {
          if (entry.kind === "item") await repo.markItem(entry.id, { qty: stored, priceMinor });
          else await repo.updateListExtra(entry.id, { qty: stored, priceMinor });
        }),
      );
    },
    // async: a validacao rejeita a promise em vez de lancar de forma sincrona.
    async addExtra(name) {
      const clean = normalizeExtraName(name);
      const key = foldText(clean);
      // Conferir e gravar juntos, na fila: um remover pendente do mesmo nome libera o nome antes.
      return enqueue(async () => {
        const taken = session.data.value.listExtras.some(
          (e) => isAlive(e) && foldText(e.name) === key,
        );
        if (taken) throw new Error(`${clean} já está na lista.`);
        return session.run((repo) => repo.addListExtra(clean));
      });
    },
    async removeExtra(id) {
      await enqueue(() => session.run((repo) => repo.removeListExtra(id)));
    },
    async restoreExtra(id) {
      await enqueue(() => session.run((repo) => repo.restoreListExtra(id)));
    },
    async pin(itemId) {
      // Na fila: um fixar logo apos um tirar (ou o inverso) grava na ordem dos toques.
      await enqueue(() => session.run((repo) => repo.markItem(itemId, { pinned: 1 })));
    },
    async unpin(itemId) {
      await enqueue(() => session.run((repo) => repo.unpinItem(itemId)));
    },
    async restorePin(itemId) {
      await enqueue(() => session.run((repo) => repo.restoreItemMark(itemId)));
    },
    checkout(list) {
      const checked = checkedEntries(list);
      const items = checked
        .filter((e) => e.kind === "item")
        .map((e) => ({ itemId: e.id, qty: e.qty, unitPriceMinor: e.priceMinor }));
      const extraIds = checked.filter((e) => e.kind === "extra").map((e) => e.id);
      // Na mesma fila dos toques: o repor espera a marcacao pendente gravar, e o banco
      // decide o que ainda esta marcado (a lista da tela so limita o conjunto).
      return enqueue(() => session.run((repo) => repo.checkout({ items, extraIds })));
    },
    async undoPin(itemId, hadMark) {
      await enqueue(async () => {
        const item = session.data.value.items.find((i) => i.id === itemId && isAlive(i));
        if (item === undefined) return;
        const d = session.data.value;
        if (liveMarkOf(item, d.movements, d.listMarks) === undefined) return;
        await session.run((repo) =>
          hadMark ? repo.markItem(itemId, { pinned: 0 }) : repo.unpinItem(itemId),
        );
      });
    },
    async undoCheckout(receipt) {
      await enqueue(() => session.run((repo) => repo.undoCheckout(receipt)));
    },
  };
}
