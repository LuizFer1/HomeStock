import type { Table } from "dexie";
import { createRowClock, type RowClock, type Stamp } from "../domain/clock/row-clock";
import { seedCategories, seedLocations } from "../domain/defaults/seeds";
import type { RandomChunk, Ulid } from "../domain/ids/ulid";
import { type BaseRow, type Draft, isAlive } from "../domain/model/base";
import {
  type Category,
  expiryAfterRestock,
  type Item,
  type Location,
  normalizeItemDraft,
} from "../domain/model/item";
import { assertExtraNumbers, type ListExtra, normalizeExtraName } from "../domain/model/list-extra";
import {
  type ListMark,
  type ListMarkPatch,
  listMarkId,
  markIsStale,
  normalizeListMarkPatch,
} from "../domain/model/list-mark";
import { type Member, type MemberDraft, normalizeMemberDraft } from "../domain/model/member";
import type { Movement, MovementReason, Price } from "../domain/model/movement";
import { normalizePlaceName } from "../domain/model/place-name";
import {
  normalizePref,
  type PrefKey,
  type PrefRow,
  type PrefValues,
  prefId,
} from "../domain/model/prefs";
import { quantityOf } from "../domain/projections/stock";
import { type HomeStockDb, LOCAL_MEMBER_KEY } from "./db";

export interface RepositoryDeps {
  db: HomeStockDb;
  now: () => number;
  randomChunk: RandomChunk;
  /** Morador deste aparelho; a fatia de onboarding liga ao `localMemberId`. */
  currentMemberId: () => Ulid | null;
  /** 'YYYY-MM-DD' local, para a data do preco. */
  today: () => string;
}

/** Tudo que esta nas tabelas, inclusive linhas apagadas. As projecoes filtram. */
export interface Snapshot {
  items: Item[];
  categories: Category[];
  locations: Location[];
  members: Member[];
  prefs: PrefRow[];
  listExtras: ListExtra[];
  listMarks: ListMark[];
  movements: Movement[];
  prices: Price[];
}

export interface CheckoutLine {
  itemId: Ulid;
  qty: number;
  /** So o preco digitado; a estimativa pelo ultimo preco nunca e gravada. */
  unitPriceMinor: number | null;
}

export interface CheckoutReceipt {
  /** Itens que entraram no lote, na ordem de `movementIds` (o toast fala so deles). */
  itemIds: Ulid[];
  movementIds: Ulid[];
  /** Marcas apagadas pelo repor, para o desfazer devolver. */
  markIds: Ulid[];
  extraIds: Ulid[];
}

export type ItemDraft = Draft<Item>;
export type ItemPatch = Partial<ItemDraft>;

function assertCount(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${what} exige inteiro >= 1, recebeu ${value}`);
  }
}

function assertPrice(unitPriceMinor: number): void {
  if (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0) {
    throw new Error(`Preco exige centavos inteiros >= 0, recebeu ${unitPriceMinor}`);
  }
}

/** Os campos editaveis do item, como o rascunho que `normalizeItemDraft` valida. */
function draftOf(item: Item): ItemDraft {
  return {
    name: item.name,
    size: item.size,
    unit: item.unit,
    categoryId: item.categoryId,
    locationId: item.locationId,
    min: item.min,
    usualQty: item.usualQty,
    expiresAt: item.expiresAt,
    ean: item.ean,
    photo: item.photo,
  };
}

/**
 * Abre o aparelho: `deviceId` (criado na primeira vez), relogio retomado do
 * maior HLC ja gravado e sementes de categorias e locais. Todos os comandos
 * de escrita moram aqui; e o unico lugar, junto com db.ts, que conhece Dexie.
 */
export async function openRepository(deps: RepositoryDeps) {
  const { db } = deps;

  const clock: RowClock = await db.transaction("rw", db.meta, async () => {
    let deviceId = (await db.meta.get("deviceId"))?.value;
    if (deviceId === undefined) {
      // O deviceId e um ULID como outro qualquer; a fabrica do relogio ainda nao existe.
      deviceId = createRowClock({
        deviceId: "0".repeat(26),
        now: deps.now,
        randomChunk: deps.randomChunk,
      }).newId();
      await db.meta.put({ key: "deviceId", value: deviceId });
    }
    return createRowClock({
      deviceId,
      initialHlc: (await db.meta.get("lastHlc"))?.value ?? null,
      now: deps.now,
      randomChunk: deps.randomChunk,
    });
  });

  await db.transaction("rw", db.categories, db.locations, async () => {
    // So grava a semente que falta: uma edicao do usuario nunca e sobrescrita.
    for (const seed of seedCategories()) {
      if ((await db.categories.get(seed.id)) === undefined) await db.categories.add(seed);
    }
    for (const seed of seedLocations()) {
      if ((await db.locations.get(seed.id)) === undefined) await db.locations.add(seed);
    }
  });

  /** Um carimbo por comando: todas as linhas dele falam do mesmo instante. */
  async function stamp(): Promise<Stamp> {
    const s = clock.stamp();
    await db.meta.put({ key: "lastHlc", value: s.hlc });
    return s;
  }

  function fresh(s: Stamp): BaseRow {
    return {
      id: clock.newId(),
      createdAt: s.iso,
      updatedAt: s.hlc,
      deletedAt: null,
      dirty: 1,
      authorId: deps.currentMemberId(),
    };
  }

  function touched<T extends BaseRow>(row: T, s: Stamp, patch: Partial<T> = {}): T {
    return { ...row, ...patch, updatedAt: s.hlc, dirty: 1, authorId: deps.currentMemberId() };
  }

  async function aliveItem(id: Ulid): Promise<Item> {
    const item = await db.items.get(id);
    if (!isAlive(item)) throw new Error(`Item ${id} nao existe`);
    return item;
  }

  async function addMovement(
    itemId: Ulid,
    delta: number,
    reason: MovementReason,
    s: Stamp,
  ): Promise<Movement> {
    const movement: Movement = { ...fresh(s), itemId, delta, reason };
    await db.movements.add(movement);
    return movement;
  }

  async function addPrice(
    itemId: Ulid,
    movement: Movement,
    unitPriceMinor: number,
    qty: number,
    s: Stamp,
  ): Promise<Price> {
    const price: Price = {
      ...fresh(s),
      itemId,
      unitPriceMinor,
      qty,
      on: deps.today(),
      movementId: movement.id,
    };
    await db.prices.add(price);
    return price;
  }

  async function currentQty(itemId: Ulid): Promise<number> {
    return quantityOf(itemId, await db.movements.where("itemId").equals(itemId).toArray());
  }

  async function setDeleted<T extends BaseRow>(
    table: Table<T, string>,
    id: Ulid,
    deleted: boolean,
  ): Promise<T> {
    return db.transaction("rw", table, db.meta, async () => {
      const row = await table.get(id);
      if (row === undefined) throw new Error(`Linha ${id} nao existe`);
      const s = await stamp();
      const next = touched(row, s, { deletedAt: deleted ? s.hlc : null } as Partial<T>);
      await table.put(next);
      return next;
    });
  }

  /** Linha da marca pronta para o patch: viva como esta, ou revivida com os padroes. */
  async function markBase(itemId: Ulid, s: Stamp): Promise<ListMark> {
    const row = await db.listMarks.get(listMarkId(itemId));
    if (isAlive(row)) return row;
    // A linha de id estavel e reaproveitada; o que ela guardava da ida anterior ao mercado nao vale mais.
    return {
      ...(row ?? fresh(s)),
      id: listMarkId(itemId),
      itemId,
      checked: 0,
      qty: null,
      priceMinor: null,
      pinned: 0,
      pinnedBy: null,
      deletedAt: null,
    };
  }

  /** Upsert da marca do item vivo; `patchOf` recebe a linha lida no banco. */
  async function writeMark(
    itemId: Ulid,
    patchOf: (base: ListMark) => ListMarkPatch,
  ): Promise<ListMark> {
    return db.transaction("rw", db.items, db.listMarks, db.meta, async () => {
      await aliveItem(itemId);
      const s = await stamp();
      const base = await markBase(itemId, s);
      const patch = patchOf(base);
      const pinnedBy =
        patch.pinned === 1 ? deps.currentMemberId() : patch.pinned === 0 ? null : base.pinnedBy;
      const next = touched(base, s, { ...patch, pinnedBy, deletedAt: null });
      await db.listMarks.put(next);
      return next;
    });
  }

  /** Apaga a marca viva do item; devolve a linha apagada ou null. */
  async function clearMark(itemId: Ulid, s: Stamp): Promise<ListMark | null> {
    const row = await db.listMarks.get(listMarkId(itemId));
    if (!isAlive(row)) return null;
    const next = touched(row, s, { deletedAt: s.hlc });
    await db.listMarks.put(next);
    return next;
  }

  /** Apaga a marca nao fixada se o item vivo ja saiu da lista (markIsStale). */
  async function clearStaleMark(itemId: Ulid, s: Stamp): Promise<void> {
    const mark = await db.listMarks.get(listMarkId(itemId));
    if (!isAlive(mark)) return;
    const item = await db.items.get(itemId);
    if (!isAlive(item)) return;
    // Soma lida dentro da transacao, ja com o movimento que o comando acabou de gravar.
    if (markIsStale(item, await currentQty(itemId), mark)) {
      await db.listMarks.put(touched(mark, s, { deletedAt: s.hlc }));
    }
  }

  /** Apaga o movimento e o preco ligado a ele; devolve o movimento, ou null se ja estava morto. */
  async function undoMovementRows(movementId: Ulid, s: Stamp): Promise<Movement | null> {
    const movement = await db.movements.get(movementId);
    if (!isAlive(movement)) return null;
    await db.movements.put(touched(movement, s, { deletedAt: s.hlc }));
    const prices = await db.prices.where("itemId").equals(movement.itemId).toArray();
    for (const price of prices) {
      if (price.movementId === movementId && isAlive(price)) {
        await db.prices.put(touched(price, s, { deletedAt: s.hlc }));
      }
    }
    return movement;
  }

  return {
    deviceId: clock.deviceId,
    /** Para o sync: o relogio salta ao receber uma linha de fora. */
    observe: (remoteHlc: string) => clock.observe(remoteHlc),

    async snapshot(): Promise<Snapshot> {
      return db.transaction(
        "r",
        [
          db.items,
          db.categories,
          db.locations,
          db.members,
          db.prefs,
          db.listExtras,
          db.listMarks,
          db.movements,
          db.prices,
        ],
        async () => ({
          items: await db.items.toArray(),
          categories: await db.categories.toArray(),
          locations: await db.locations.toArray(),
          members: await db.members.toArray(),
          prefs: await db.prefs.toArray(),
          listExtras: await db.listExtras.toArray(),
          listMarks: await db.listMarks.toArray(),
          movements: await db.movements.toArray(),
          prices: await db.prices.toArray(),
        }),
      );
    },

    async createItem(draft: ItemDraft, initialQty = 0, unitPriceMinor?: number): Promise<Item> {
      if (!Number.isInteger(initialQty) || initialQty < 0) {
        throw new Error(`Quantidade inicial exige inteiro >= 0, recebeu ${initialQty}`);
      }
      if (unitPriceMinor !== undefined) {
        assertPrice(unitPriceMinor);
        if (initialQty < 1) {
          throw new Error(`Preco exige quantidade inicial >= 1, recebeu ${initialQty}`);
        }
      }
      const clean = normalizeItemDraft(draft);
      return db.transaction("rw", db.items, db.movements, db.prices, db.meta, async () => {
        const s = await stamp();
        const item: Item = { ...fresh(s), ...clean };
        await db.items.add(item);
        if (unitPriceMinor === undefined) {
          if (initialQty > 0) await addMovement(item.id, initialQty, "initial", s);
        } else {
          // Com preco e uma compra: o preco fica ligado a um restock, como em toda reposicao.
          const movement = await addMovement(item.id, initialQty, "restock", s);
          await addPrice(item.id, movement, unitPriceMinor, initialQty, s);
        }
        return item;
      });
    },

    /** A quantidade nao passa por aqui: muda-la e `adjustTo`, que gera movimento. */
    async updateItem(id: Ulid, patch: ItemPatch): Promise<Item> {
      if ("qty" in patch) throw new Error("Quantidade muda por movimento, nao por patch");
      return db.transaction("rw", db.items, db.movements, db.listMarks, db.meta, async () => {
        const item = await aliveItem(id);
        const clean = normalizeItemDraft({
          ...draftOf(item),
          // undefined significa "inalterado", nao "apague o campo".
          ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        });
        const s = await stamp();
        const next = touched<Item>(item, s, clean);
        await db.items.put(next);
        // O minimo pode ter mudado e tirado o item da lista.
        await clearStaleMark(id, s);
        return next;
      });
    },

    /** Movimentos e precos ficam: desfazer devolve o item com a mesma quantidade. */
    deleteItem: (id: Ulid) => setDeleted(db.items, id, true),
    restoreItem: (id: Ulid) => setDeleted(db.items, id, false),

    async useItem(id: Ulid, n = 1): Promise<Movement> {
      assertCount(n, "Consumo");
      return db.transaction("rw", db.items, db.movements, db.meta, async () => {
        await aliveItem(id);
        return addMovement(id, -n, "use", await stamp());
      });
    },

    async restock(
      id: Ulid,
      qty: number,
      unitPriceMinor?: number,
      incomingExpiry: string | null = null,
    ): Promise<{
      movement: Movement;
      price: Price | null;
      expiry: { before: string | null; after: string | null };
    }> {
      assertCount(qty, "Reposicao");
      if (unitPriceMinor !== undefined) assertPrice(unitPriceMinor);
      const tables = [db.items, db.movements, db.prices, db.listMarks, db.meta];
      return db.transaction("rw", tables, async () => {
        const item = await aliveItem(id);
        // Soma lida antes de gravar o movimento: e o que ja estava na despensa.
        const qtyBefore = await currentQty(id);
        const after = expiryAfterRestock(item.expiresAt, incomingExpiry, qtyBefore);
        const s = await stamp();
        const movement = await addMovement(id, qty, "restock", s);
        // Compra registrada por qualquer caminho encerra a ida ao mercado deste item.
        await clearMark(id, s);
        // A linha inteira e regravada (LWW por linha): edicao concorrente de outro
        // aparelho pode perder. So acontece quando a validade muda.
        if (after !== item.expiresAt) {
          const clean = normalizeItemDraft({ ...draftOf(item), expiresAt: after });
          await db.items.put(touched(item, s, clean));
        }
        const price =
          unitPriceMinor === undefined
            ? null
            : await addPrice(id, movement, unitPriceMinor, qty, s);
        return { movement, price, expiry: { before: item.expiresAt, after } };
      });
    },

    /** Edicao direta da quantidade: grava a diferenca sobre a soma atual. */
    async adjustTo(id: Ulid, target: number): Promise<Movement | null> {
      if (!Number.isInteger(target) || target < 0) {
        throw new Error(`Quantidade exige inteiro >= 0, recebeu ${target}`);
      }
      return db.transaction("rw", db.items, db.movements, db.listMarks, db.meta, async () => {
        await aliveItem(id);
        const delta = target - (await currentQty(id));
        if (delta === 0) return null;
        const s = await stamp();
        const movement = await addMovement(id, delta, "adjust", s);
        await clearStaleMark(id, s);
        return movement;
      });
    },

    /** Desfaz um movimento e o preco que veio com ele. */
    async undoMovement(
      movementId: Ulid,
      expiry?: { before: string | null; after: string | null },
    ): Promise<void> {
      const tables = [db.items, db.movements, db.prices, db.listMarks, db.meta];
      await db.transaction("rw", tables, async () => {
        // Sem carimbo (nem escrita em meta) quando nao ha o que desfazer.
        if (!isAlive(await db.movements.get(movementId))) return;
        const s = await stamp();
        const movement = await undoMovementRows(movementId, s);
        if (movement === null) return;
        if (expiry !== undefined && expiry.before !== expiry.after) {
          const item = await db.items.get(movement.itemId);
          // Validade mudada depois por outra pessoa ou tela fica: o desfazer so devolve o que esta reposicao trocou.
          if (isAlive(item) && item.expiresAt === expiry.after) {
            await db.items.put(touched(item, s, { expiresAt: expiry.before }));
          }
        }
        // Desfazer um uso pode devolver o item ao minimo.
        await clearStaleMark(movement.itemId, s);
      });
    },

    /** Grava o patch na marca do item (cria ou revive a linha de id estavel). */
    async markItem(itemId: Ulid, patch: ListMarkPatch): Promise<ListMark> {
      const clean = normalizeListMarkPatch(patch);
      return writeMark(itemId, () => clean);
    },

    /** Inverte o `checked` lido no banco, nunca o do render. */
    async toggleItemMark(itemId: Ulid): Promise<ListMark> {
      return writeMark(itemId, (base) => ({ checked: base.checked === 1 ? 0 : 1 }));
    },

    /** Tirar da lista: todas as anotacoes da marca saem junto. */
    unpinItem: (itemId: Ulid) => setDeleted(db.listMarks, listMarkId(itemId), true),
    restoreItemMark: (itemId: Ulid) => setDeleted(db.listMarks, listMarkId(itemId), false),

    /**
     * Repor estoque: um restock por item vivo, preco so quando digitado, marcas
     * e pedidos apagados. Uma transacao e um carimbo: nada fica pela metade.
     */
    async checkout(input: {
      items: readonly CheckoutLine[];
      extraIds: readonly Ulid[];
    }): Promise<CheckoutReceipt> {
      for (const line of input.items) {
        assertCount(line.qty, "Reposicao");
        if (line.unitPriceMinor !== null) assertPrice(line.unitPriceMinor);
      }
      const tables = [db.items, db.movements, db.prices, db.listMarks, db.listExtras, db.meta];
      return db.transaction("rw", tables, async () => {
        const s = await stamp();
        const receipt: CheckoutReceipt = {
          itemIds: [],
          movementIds: [],
          markIds: [],
          extraIds: [],
        };
        // A tela manda o que a pessoa viu marcado: marca escondida (autoList desligado) nao vira estoque.
        // E o banco decide se ainda esta marcado: um toque que desmarcou depois de a tela
        // montar a lista (ou outro aparelho) tira a linha do lote.
        for (const line of input.items) {
          if (!isAlive(await db.items.get(line.itemId))) continue;
          const mark = await db.listMarks.get(listMarkId(line.itemId));
          if (!isAlive(mark) || mark.checked !== 1) continue;
          const movement = await addMovement(line.itemId, line.qty, "restock", s);
          receipt.itemIds.push(line.itemId);
          receipt.movementIds.push(movement.id);
          if (line.unitPriceMinor !== null) {
            await addPrice(line.itemId, movement, line.unitPriceMinor, line.qty, s);
          }
          const cleared = await clearMark(line.itemId, s);
          if (cleared !== null) receipt.markIds.push(cleared.id);
        }
        for (const id of input.extraIds) {
          const extra = await db.listExtras.get(id);
          if (!isAlive(extra) || extra.checked !== 1) continue;
          await db.listExtras.put(touched(extra, s, { deletedAt: s.hlc }));
          receipt.extraIds.push(id);
        }
        return receipt;
      });
    },

    /** Desfaz o repor: movimentos e precos saem; marcas e pedidos ainda apagados voltam. */
    async undoCheckout(receipt: CheckoutReceipt): Promise<void> {
      const tables = [db.items, db.movements, db.prices, db.listMarks, db.listExtras, db.meta];
      await db.transaction("rw", tables, async () => {
        const s = await stamp();
        for (const id of receipt.movementIds) await undoMovementRows(id, s);
        for (const id of receipt.markIds) {
          const mark = await db.listMarks.get(id);
          if (mark !== undefined && mark.deletedAt !== null) {
            await db.listMarks.put(touched(mark, s, { deletedAt: null }));
            // Outra escrita depois do repor pode ter tirado o item da lista: marca
            // revivida ai renasceria na proxima vez que ele ficasse abaixo do minimo.
            await clearStaleMark(mark.itemId, s);
          }
        }
        for (const id of receipt.extraIds) {
          const extra = await db.listExtras.get(id);
          if (extra !== undefined && extra.deletedAt !== null) {
            await db.listExtras.put(touched(extra, s, { deletedAt: null }));
          }
        }
      });
    },

    async addListExtra(
      rawName: string,
      qty: number | null = null,
      priceMinor: number | null = null,
    ): Promise<ListExtra> {
      const name = normalizeExtraName(rawName);
      assertExtraNumbers(qty, priceMinor);
      return db.transaction("rw", db.listExtras, db.meta, async () => {
        const extra: ListExtra = {
          ...fresh(await stamp()),
          name,
          qty,
          priceMinor,
          checked: 0,
          // authorId muda a cada escrita; quem pediu fica.
          requestedBy: deps.currentMemberId(),
        };
        await db.listExtras.add(extra);
        return extra;
      });
    },

    /** Quantidade e preco do pedido vivo (LWW). undefined significa "inalterado". */
    async updateListExtra(
      id: Ulid,
      patch: { qty?: number | null; priceMinor?: number | null },
    ): Promise<ListExtra> {
      return db.transaction("rw", db.listExtras, db.meta, async () => {
        const extra = await db.listExtras.get(id);
        if (!isAlive(extra)) throw new Error(`Pedido ${id} nao existe`);
        const qty = patch.qty === undefined ? extra.qty : patch.qty;
        const priceMinor = patch.priceMinor === undefined ? extra.priceMinor : patch.priceMinor;
        assertExtraNumbers(qty, priceMinor);
        const next = touched(extra, await stamp(), { qty, priceMinor });
        await db.listExtras.put(next);
        return next;
      });
    },

    async toggleListExtra(id: Ulid): Promise<ListExtra> {
      return db.transaction("rw", db.listExtras, db.meta, async () => {
        const extra = await db.listExtras.get(id);
        if (!isAlive(extra)) throw new Error(`Pedido ${id} nao existe`);
        const next = touched(extra, await stamp(), { checked: extra.checked === 1 ? 0 : 1 });
        await db.listExtras.put(next);
        return next;
      });
    },

    removeListExtra: (id: Ulid) => setDeleted(db.listExtras, id, true),
    restoreListExtra: (id: Ulid) => setDeleted(db.listExtras, id, false),

    async upsertCategory(name: string, id?: Ulid): Promise<Category> {
      return upsertNamed(db.categories, name, id);
    },

    async upsertLocation(name: string, id?: Ulid): Promise<Location> {
      return upsertNamed(db.locations, name, id);
    },

    /** Itens que apontam para a categoria ficam como estao; a UI mostra "Sem categoria". */
    removeCategory: (id: Ulid) => setDeleted(db.categories, id, true),
    removeLocation: (id: Ulid) => setDeleted(db.locations, id, true),

    /** Morador deste aparelho, ou null antes do onboarding. Estado do aparelho, nunca sincroniza. */
    async localMemberId(): Promise<Ulid | null> {
      return (await db.meta.get(LOCAL_MEMBER_KEY))?.value ?? null;
    },

    /**
     * Linha do morador e `meta.localMemberId` numa transacao: falha nao deixa
     * morador sem dono nem dono sem morador. O `authorId` e o proprio id, porque
     * `currentMemberId()` ainda e null neste instante.
     */
    async createLocalMember(draft: MemberDraft): Promise<Member> {
      const clean = normalizeMemberDraft(draft);
      return db.transaction("rw", db.members, db.meta, async () => {
        if ((await db.meta.get(LOCAL_MEMBER_KEY)) !== undefined) {
          throw new Error("Este aparelho ja tem morador local");
        }
        const base = fresh(await stamp());
        const member: Member = { ...base, authorId: base.id, ...clean, role: "admin" };
        await db.members.add(member);
        await db.meta.put({ key: LOCAL_MEMBER_KEY, value: member.id });
        return member;
      });
    },

    /** Nome, cor e foto (LWW). O resultado do merge passa pela mesma validacao da criacao. */
    async updateMember(id: Ulid, patch: Partial<MemberDraft>): Promise<Member> {
      return db.transaction("rw", db.members, db.meta, async () => {
        const member = await db.members.get(id);
        if (!isAlive(member)) throw new Error(`Morador ${id} nao existe`);
        const clean = normalizeMemberDraft({
          name: member.name,
          color: member.color,
          photo: member.photo,
          // undefined significa "inalterado", nao "apague o campo".
          ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)),
        });
        const next = touched(member, await stamp(), clean);
        await db.members.put(next);
        return next;
      });
    },

    /** Cria a linha de id `prefId(key)` ou carimba a existente (limpando `deletedAt`). */
    async setPref<K extends PrefKey>(key: K, value: PrefValues[K]): Promise<PrefRow> {
      const clean = normalizePref(key, value);
      return db.transaction("rw", db.prefs, db.meta, async () => {
        const s = await stamp();
        const existing = await db.prefs.get(prefId(key));
        const row: PrefRow =
          existing === undefined
            ? { ...fresh(s), id: prefId(key), key, value: clean }
            : touched(existing, s, { value: clean, deletedAt: null });
        await db.prefs.put(row);
        return row;
      });
    },

    /**
     * Item vivo com este EAN, para o "Achamos!" do scanner. `exceptId` pula um
     * item: o indice nao e unico (o sync traz duplicata) e o primeiro achado
     * pode ser o proprio item em edicao, escondendo o outro.
     */
    async findByEan(ean: string, exceptId?: Ulid): Promise<Item | null> {
      const found = await db.items.where("ean").equals(ean).toArray();
      return found.find((item) => isAlive(item) && item.id !== exceptId) ?? null;
    },
  };

  /** Categoria e local tem a mesma forma: so o nome. */
  async function upsertNamed<T extends Category | Location>(
    table: Table<T, string>,
    rawName: string,
    id?: Ulid,
  ): Promise<T> {
    const name = normalizePlaceName(rawName);
    return db.transaction("rw", table, db.meta, async () => {
      const s = await stamp();
      const existing = id === undefined ? undefined : await table.get(id);
      const row =
        existing === undefined
          ? ({ ...fresh(s), name } as T)
          : touched(existing, s, { name } as Partial<T>);
      await table.put(row);
      return row;
    });
  }
}

export type Repository = Awaited<ReturnType<typeof openRepository>>;
