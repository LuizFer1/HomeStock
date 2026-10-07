import type { Table } from "dexie";
import { createRowClock, type RowClock, type Stamp } from "../domain/clock/row-clock";
import { seedCategories, seedLocations } from "../domain/defaults/seeds";
import type { RandomChunk, Ulid } from "../domain/ids/ulid";
import { type BaseRow, type Draft, isAlive } from "../domain/model/base";
import type { Category, Item, Location } from "../domain/model/item";
import type { ListExtra } from "../domain/model/list-extra";
import type { Member } from "../domain/model/member";
import type { Movement, MovementReason, Price } from "../domain/model/movement";
import { quantityOf } from "../domain/projections/stock";
import type { HomeStockDb } from "./db";

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
  listExtras: ListExtra[];
  movements: Movement[];
  prices: Price[];
}

export type ItemDraft = Draft<Item>;
export type ItemPatch = Partial<ItemDraft>;

function assertCount(value: number, what: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${what} exige inteiro >= 1, recebeu ${value}`);
  }
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

  return {
    deviceId: clock.deviceId,
    /** Para o sync: o relogio salta ao receber uma linha de fora. */
    observe: (remoteHlc: string) => clock.observe(remoteHlc),

    async snapshot(): Promise<Snapshot> {
      return db.transaction(
        "r",
        [db.items, db.categories, db.locations, db.members, db.listExtras, db.movements, db.prices],
        async () => ({
          items: await db.items.toArray(),
          categories: await db.categories.toArray(),
          locations: await db.locations.toArray(),
          members: await db.members.toArray(),
          listExtras: await db.listExtras.toArray(),
          movements: await db.movements.toArray(),
          prices: await db.prices.toArray(),
        }),
      );
    },

    async createItem(draft: ItemDraft, initialQty = 0): Promise<Item> {
      if (!Number.isInteger(initialQty) || initialQty < 0) {
        throw new Error(`Quantidade inicial exige inteiro >= 0, recebeu ${initialQty}`);
      }
      assertCount(draft.usualQty, "Quantidade usual");
      return db.transaction("rw", db.items, db.movements, db.meta, async () => {
        const s = await stamp();
        const item: Item = { ...fresh(s), ...draft };
        await db.items.add(item);
        if (initialQty > 0) await addMovement(item.id, initialQty, "initial", s);
        return item;
      });
    },

    /** A quantidade nao passa por aqui: muda-la e `adjustTo`, que gera movimento. */
    async updateItem(id: Ulid, patch: ItemPatch): Promise<Item> {
      if ("qty" in patch) throw new Error("Quantidade muda por movimento, nao por patch");
      return db.transaction("rw", db.items, db.meta, async () => {
        const item = await aliveItem(id);
        const next = touched<Item>(item, await stamp(), patch);
        await db.items.put(next);
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
    ): Promise<{ movement: Movement; price: Price | null }> {
      assertCount(qty, "Reposicao");
      if (
        unitPriceMinor !== undefined &&
        (!Number.isInteger(unitPriceMinor) || unitPriceMinor < 0)
      ) {
        throw new Error(`Preco exige centavos inteiros >= 0, recebeu ${unitPriceMinor}`);
      }
      return db.transaction("rw", db.items, db.movements, db.prices, db.meta, async () => {
        await aliveItem(id);
        const s = await stamp();
        const movement = await addMovement(id, qty, "restock", s);
        if (unitPriceMinor === undefined) return { movement, price: null };
        const price: Price = {
          ...fresh(s),
          itemId: id,
          unitPriceMinor,
          qty,
          on: deps.today(),
          movementId: movement.id,
        };
        await db.prices.add(price);
        return { movement, price };
      });
    },

    /** Edicao direta da quantidade: grava a diferenca sobre a soma atual. */
    async adjustTo(id: Ulid, target: number): Promise<Movement | null> {
      if (!Number.isInteger(target) || target < 0) {
        throw new Error(`Quantidade exige inteiro >= 0, recebeu ${target}`);
      }
      return db.transaction("rw", db.items, db.movements, db.meta, async () => {
        await aliveItem(id);
        const delta = target - (await currentQty(id));
        if (delta === 0) return null;
        return addMovement(id, delta, "adjust", await stamp());
      });
    },

    /** Desfaz um movimento e o preco que veio com ele. */
    async undoMovement(movementId: Ulid): Promise<void> {
      await db.transaction("rw", db.movements, db.prices, db.meta, async () => {
        const movement = await db.movements.get(movementId);
        if (!isAlive(movement)) return;
        const s = await stamp();
        await db.movements.put(touched(movement, s, { deletedAt: s.hlc }));
        const prices = await db.prices.where("itemId").equals(movement.itemId).toArray();
        for (const price of prices) {
          if (price.movementId === movementId && isAlive(price)) {
            await db.prices.put(touched(price, s, { deletedAt: s.hlc }));
          }
        }
      });
    },

    async addListExtra(name: string, qty: number | null = null, priceMinor: number | null = null) {
      return db.transaction("rw", db.listExtras, db.meta, async () => {
        const extra: ListExtra = { ...fresh(await stamp()), name, qty, priceMinor, checked: 0 };
        await db.listExtras.add(extra);
        return extra;
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

    async upsertCategory(name: string, id?: Ulid): Promise<Category> {
      return upsertNamed(db.categories, name, id);
    },

    async upsertLocation(name: string, id?: Ulid): Promise<Location> {
      return upsertNamed(db.locations, name, id);
    },

    /** Itens que apontam para a categoria ficam como estao; a UI mostra "Sem categoria". */
    removeCategory: (id: Ulid) => setDeleted(db.categories, id, true),
    removeLocation: (id: Ulid) => setDeleted(db.locations, id, true),

    /** Item vivo com este EAN, para o "Achamos!" do scanner. */
    async findByEan(ean: string): Promise<Item | null> {
      const found = await db.items.where("ean").equals(ean).toArray();
      return found.find((item) => isAlive(item)) ?? null;
    },
  };

  /** Categoria e local tem a mesma forma: so o nome. */
  async function upsertNamed<T extends Category | Location>(
    table: Table<T, string>,
    name: string,
    id?: Ulid,
  ): Promise<T> {
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
