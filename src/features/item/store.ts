import type { ItemDraft, Repository } from "../../data/repository";
import type { Ulid } from "../../domain/ids/ulid";
import { type Item, normalizeItemDraft } from "../../domain/model/item";
import type { Movement } from "../../domain/model/movement";
import type { Session } from "../session/session";

export interface RestockReceipt {
  movementId: Ulid;
  /** Validade antes e depois da reposicao; iguais quando nada mudou. */
  expiry: { before: string | null; after: string | null };
  /** Marca da lista que o restock apagou; o desfazer a devolve. */
  clearedMarkId: Ulid | null;
}

/** Movimento do stepper e, no +, a marca da lista que ele apagou. */
export type StepResult = Movement & { clearedMarkId: Ulid | null };

/** Comandos de item para as telas: formulario, apagar, devolver e o stepper do Detalhe. */
export interface ItemStore {
  /** Recusa EAN de outro item vivo. Com preco, a entrada e um restock com Price. */
  create: (draft: ItemDraft, qty: number, unitPriceMinor?: number | null) => Promise<Item>;
  /** Uma `run`: updateItem e, com `qty` numero diferente da soma, adjustTo. */
  save: (id: Ulid, draft: ItemDraft, qty: number | null) => Promise<void>;
  remove: (id: Ulid) => Promise<void>;
  /** Movimentos ficam intactos ao apagar: devolve com a mesma quantidade. */
  restore: (id: Ulid) => Promise<void>;
  /** Fila serial: -1 grava useItem(id, 1), +1 grava restock(id, 1) sem preco. */
  step: (id: Ulid, direction: 1 | -1) => Promise<StepResult>;
  /** Desfaz um toque do stepper apagando o movimento (e o preco, se houver). */
  undo: (movementId: Ulid, clearedMarkId?: Ulid | null) => Promise<void>;
  /** Reposicao do scanner: restock com preco e validade opcionais, numa transacao. */
  restockScan: (
    id: Ulid,
    qty: number,
    unitPriceMinor: number | null,
    expiresAt: string | null,
  ) => Promise<RestockReceipt>;
  /** Apaga movimento e preco e devolve a validade se ninguem a mudou depois. */
  undoRestock: (receipt: RestockReceipt) => Promise<void>;
}

/**
 * O indice de EAN nao e unico (o sync pode trazer duplicata); a tela recusa
 * antes de gravar, com o EAN ja normalizado, que e o valor que iria ao banco.
 */
async function assertEanFree(repo: Repository, ean: string | null, self?: Ulid) {
  if (ean === null) return;
  const other = await repo.findByEan(ean, self);
  if (other !== null) {
    throw new Error(`O código ${ean} já é de ${other.name}.`);
  }
}

export function createItemStore(session: Session): ItemStore {
  // Cada toque conta (nao ha guarda de duplo envio), mas um por vez: dois
  // toques seguidos nao podem gravar fora de ordem nem ler a mesma soma.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    // async: a validacao lanca como promise rejeitada, nao de forma sincrona.
    async create(draft, qty, unitPriceMinor) {
      const clean = normalizeItemDraft(draft);
      return session.run(async (repo) => {
        await assertEanFree(repo, clean.ean);
        return repo.createItem(clean, qty, unitPriceMinor ?? undefined);
      });
    },
    async save(id, draft, qty) {
      const clean = normalizeItemDraft(draft);
      await session.run(async (repo) => {
        // EAN que nao mudou nao e checado: com duplicata do sync, editar o
        // minimo de um dos dois nao pode ficar travado pelo outro.
        const stored = session.data.value.items.find((i) => i.id === id)?.ean ?? null;
        if (clean.ean !== stored) await assertEanFree(repo, clean.ean, id);
        await repo.updateItem(id, clean);
        // adjustTo nao grava nada se a soma ja e o alvo.
        if (qty !== null) await repo.adjustTo(id, qty);
      });
    },
    async remove(id) {
      await session.run((repo) => repo.deleteItem(id));
    },
    async restore(id) {
      await session.run((repo) => repo.restoreItem(id));
    },
    step(id, direction) {
      const next = queue.then(() =>
        session.run((repo) =>
          direction < 0
            ? repo.useItem(id, 1).then((movement) => ({ ...movement, clearedMarkId: null }))
            : repo.restock(id, 1).then((r) => ({ ...r.movement, clearedMarkId: r.clearedMarkId })),
        ),
      );
      // A falha volta para quem tocou; a fila segue para o proximo toque.
      queue = next.catch(() => {});
      return next;
    },
    async undo(movementId, clearedMarkId = null) {
      await session.run((repo) => repo.undoMovement(movementId, undefined, clearedMarkId));
    },
    // Fora da fila do step: a reposicao e um toque so, com trava na tela.
    async restockScan(id, qty, unitPriceMinor, expiresAt) {
      const r = await session.run((repo) =>
        repo.restock(id, qty, unitPriceMinor ?? undefined, expiresAt),
      );
      return { movementId: r.movement.id, expiry: r.expiry, clearedMarkId: r.clearedMarkId };
    },
    async undoRestock(receipt) {
      await session.run((repo) =>
        repo.undoMovement(receipt.movementId, receipt.expiry, receipt.clearedMarkId),
      );
    },
  };
}
