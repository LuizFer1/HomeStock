import Dexie, { type Table } from "dexie";
import type { Category, Item, Location } from "../domain/model/item";
import type { ListExtra } from "../domain/model/list-extra";
import type { Member } from "../domain/model/member";
import type { Movement, Price } from "../domain/model/movement";

export interface MetaRow {
  key: string;
  value: string;
}

/**
 * Uma tabela por entidade; a linha e o estado atual. `dirty` indexado em todas
 * as que sincronizam: e por ele que o HubStock vai saber o que enviar. `meta`
 * e do aparelho e nunca sincroniza.
 *
 * O construtor nunca lanca; a falha de IndexedDB aparece na primeira operacao.
 */
export class HomeStockDb extends Dexie {
  readonly items: Table<Item, string>;
  readonly categories: Table<Category, string>;
  readonly locations: Table<Location, string>;
  readonly members: Table<Member, string>;
  readonly listExtras: Table<ListExtra, string>;
  readonly movements: Table<Movement, string>;
  readonly prices: Table<Price, string>;
  readonly meta: Table<MetaRow, string>;

  constructor(name = "homestock") {
    super(name);
    this.version(1).stores({
      items: "id, ean, dirty",
      categories: "id, dirty",
      locations: "id, dirty",
      members: "id, dirty",
      listExtras: "id, dirty",
      movements: "id, itemId, dirty",
      prices: "id, itemId, dirty",
      meta: "key",
    });
    this.items = this.table("items");
    this.categories = this.table("categories");
    this.locations = this.table("locations");
    this.members = this.table("members");
    this.listExtras = this.table("listExtras");
    this.movements = this.table("movements");
    this.prices = this.table("prices");
    this.meta = this.table("meta");
  }
}

/** Tabelas que sincronizam, na ordem em que o sync deve aplica-las. */
export const SYNCED_TABLES = [
  "members",
  "categories",
  "locations",
  "items",
  "movements",
  "prices",
  "listExtras",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
