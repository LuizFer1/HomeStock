import Dexie, { type Table } from "dexie";
import type { Category, Item, Location } from "../domain/model/item";
import type { ListExtra } from "../domain/model/list-extra";
import type { ListMark } from "../domain/model/list-mark";
import type { Member } from "../domain/model/member";
import type { Movement, Price } from "../domain/model/movement";
import type { PrefRow } from "../domain/model/prefs";

/** Chave de `meta` com o morador deste aparelho. */
export const LOCAL_MEMBER_KEY = "localMemberId";

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
  readonly prefs: Table<PrefRow, string>;
  readonly listExtras: Table<ListExtra, string>;
  readonly listMarks: Table<ListMark, string>;
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
    // Aditiva: a v1 fica intacta e o Dexie migra sem tocar nos dados.
    this.version(2).stores({ prefs: "id, dirty" });
    // Aditiva, como a v2.
    this.version(3).stores({ listMarks: "id, itemId, dirty" });
    this.items = this.table("items");
    this.categories = this.table("categories");
    this.locations = this.table("locations");
    this.members = this.table("members");
    this.prefs = this.table("prefs");
    this.listExtras = this.table("listExtras");
    this.listMarks = this.table("listMarks");
    this.movements = this.table("movements");
    this.prices = this.table("prices");
    this.meta = this.table("meta");
  }
}

/** Tabelas que sincronizam, na ordem em que o sync deve aplica-las. */
export const SYNCED_TABLES = [
  "members",
  "prefs",
  "categories",
  "locations",
  "items",
  "movements",
  "prices",
  "listExtras",
  "listMarks",
] as const;

export type SyncedTable = (typeof SYNCED_TABLES)[number];
