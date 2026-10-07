import type { Snapshot } from "../../data/repository";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import type { Category, Item, Location } from "../../domain/model/item";
import type { Movement } from "../../domain/model/movement";
import { consumptionOf } from "../../domain/projections/consumption";
import {
  type ItemStatus,
  type PrimaryStatus,
  quantities,
  statusOf,
} from "../../domain/projections/stock";
import { statusNote } from "../item/labels";

export type FilterKey = "all" | `cat:${string}` | `loc:${string}`;

export interface StockRow {
  item: Item;
  /** max(0, soma dos movimentos). */
  qty: number;
  status: ItemStatus;
  /** 4..100. */
  level: number;
  note: string;
  /** Media de dias por unidade, ou null. */
  average: number | null;
}

export interface StockFilter {
  key: FilterKey;
  label: string;
  count: number;
}

/** O que pede atencao primeiro (markup). */
const STATUS_ORDER: Record<PrimaryStatus, number> = { out: 0, low: 1, exp: 2, ok: 3 };

const byName = (a: string, b: string) => a.localeCompare(b, "pt-BR");

/** Largura da barra do card: o dobro do minimo enche a barra; piso de 4 para nao sumir. */
export function levelOf(qty: number, min: number): number {
  if (min <= 0) return qty > 0 ? 100 : 4;
  return Math.max(4, Math.min(100, Math.round((qty / (min * 2)) * 100)));
}

/** Itens vivos, com status, nivel e nota; ordem out, low, exp, ok e depois nome pt-BR. */
export function buildStockRows(
  data: Pick<Snapshot, "items" | "movements">,
  today: string,
  expDays: number,
): StockRow[] {
  const qty = quantities(data.movements);
  // Os consumos agrupados uma vez: `consumptionOf` por item varreria todos os
  // movimentos da casa a cada card.
  const uses = new Map<Ulid, Movement[]>();
  for (const m of data.movements) {
    if (m.reason !== "use") continue;
    const list = uses.get(m.itemId);
    if (list === undefined) uses.set(m.itemId, [m]);
    else list.push(m);
  }

  const rows: StockRow[] = [];
  for (const item of data.items) {
    if (!isAlive(item)) continue;
    const q = Math.max(0, qty.get(item.id) ?? 0);
    const status = statusOf(item, q, today, expDays);
    const { average } = consumptionOf(item.id, uses.get(item.id) ?? []);
    rows.push({
      item,
      qty: q,
      status,
      level: levelOf(q, item.min),
      note: statusNote(status, item, q, average, today),
      average,
    });
  }
  return rows.sort(
    (a, b) =>
      STATUS_ORDER[a.status.primary] - STATUS_ORDER[b.status.primary] ||
      byName(a.item.name, b.item.name),
  );
}

/** Todos + categorias e locais vivos com >= 1 item (e o `active`, mesmo com 0), cada grupo alfabetico. */
export function buildFilters(
  rows: readonly StockRow[],
  data: Pick<Snapshot, "categories" | "locations">,
  active: FilterKey,
): StockFilter[] {
  const group = (
    places: readonly (Category | Location)[],
    prefix: "cat" | "loc",
    of: (item: Item) => Ulid | null,
  ): StockFilter[] =>
    places
      .filter((place) => isAlive(place))
      .map((place) => ({
        key: `${prefix}:${place.id}` as FilterKey,
        label: place.name,
        count: rows.filter((row) => of(row.item) === place.id).length,
      }))
      // Seis locais semeados e vazios virariam seis chips "0" no carrossel.
      .filter((f) => f.count > 0 || f.key === active)
      .sort((a, b) => byName(a.label, b.label));

  return [
    { key: "all", label: "Todos", count: rows.length },
    ...group(data.categories, "cat", (item) => item.categoryId),
    ...group(data.locations, "loc", (item) => item.locationId),
  ];
}

/** Filtro de linha apagada ou desconhecida vira "all". */
export function validFilter(
  key: FilterKey,
  data: Pick<Snapshot, "categories" | "locations">,
): FilterKey {
  if (key === "all") return key;
  const [prefix, ...rest] = key.split(":");
  const id = rest.join(":");
  const table = prefix === "cat" ? data.categories : prefix === "loc" ? data.locations : [];
  return table.some((row) => row.id === id && isAlive(row)) ? key : "all";
}

/** Sem acento, sem caixa, com trim. */
export function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function inFilter(item: Item, filter: FilterKey): boolean {
  if (filter === "all") return true;
  if (filter.startsWith("cat:")) return item.categoryId === filter.slice(4);
  return item.locationId === filter.slice(4);
}

/** Filtro E busca: nome ou tamanho contem a busca; busca so de digitos tambem casa com o EAN. */
export function visibleRows(
  rows: readonly StockRow[],
  filter: FilterKey,
  query: string,
): StockRow[] {
  const q = fold(query);
  const digits = /^\d+$/.test(q);
  return rows.filter(({ item }) => {
    if (!inFilter(item, filter)) return false;
    if (q === "") return true;
    if (fold(item.name).includes(q) || fold(item.size).includes(q)) return true;
    return digits && (item.ean?.includes(q) ?? false);
  });
}
