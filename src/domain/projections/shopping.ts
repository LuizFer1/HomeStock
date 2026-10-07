import { compareHlc } from "../clock/hlc";
import type { Ulid } from "../ids/ulid";
import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import { type ListExtra, requesterOf } from "../model/list-extra";
import type { ListMark } from "../model/list-mark";
import type { Movement, Price } from "../model/movement";
import { quantities } from "./stock";
import { lastPriceOf } from "./value";

export type ShoppingReason = "out" | "low";

export interface ShoppingEntry {
  /** `item:<id>` ou `extra:<id>`: chave estavel da linha na tela. */
  key: string;
  kind: "item" | "extra";
  /** Id do item (kind item) ou do pedido (kind extra). */
  id: Ulid;
  section: "auto" | "house";
  /** Nome do item ou do pedido. */
  name: string;
  /** Tamanho do item; "" no pedido. */
  size: string;
  /** Unidade do item; "" no pedido. */
  unit: string;
  /** A comprar: mark.qty ?? usualQty (item), qty ?? 1 (pedido). */
  qty: number;
  /** O que vale sem edicao: usualQty (item), 1 (pedido). Salvar este valor grava null. */
  suggestion: number;
  /** Quanto ha em casa (max 0); null no pedido. */
  have: number | null;
  /** Motivo automatico; null em "Pedidos da casa". */
  reason: ShoppingReason | null;
  /** Quem pediu (pedido: requesterOf; item fixado: pinnedBy). */
  requestedBy: Ulid | null;
  pinned: boolean;
  checked: boolean;
  /** Preco unitario digitado; null sem. */
  priceMinor: number | null;
  /** Ultimo preco do item quando nada foi digitado; null no pedido ou sem historico. */
  estimateMinor: number | null;
}

export interface ShoppingList {
  auto: ShoppingEntry[];
  house: ShoppingEntry[];
  done: number;
  total: number;
  /** Soma dos nao marcados com preco conhecido (digitado ou estimado), em centavos. */
  remainingMinor: number;
  /** Nao marcados sem preco nenhum. */
  unpriced: number;
}

export type ListStatus = "auto" | "pinned" | "off";

/** Unitario conhecido de uma linha: digitado, senao estimado; null sem nenhum. */
export function unitPriceOf(entry: ShoppingEntry): number | null {
  return entry.priceMinor ?? entry.estimateMinor;
}

/**
 * Linhas marcadas que a pessoa ve, na ordem da tela. Fonte unica do que o repor leva
 * e do que o toast conta: a tela e a store nao podem filtrar cada uma do seu jeito.
 */
export function checkedEntries(list: Pick<ShoppingList, "auto" | "house">): ShoppingEntry[] {
  return [...list.auto, ...list.house].filter((e) => e.checked);
}

const byName = (a: ShoppingEntry, b: ShoppingEntry) => a.name.localeCompare(b.name, "pt-BR");

/**
 * Marcas vivas de itens vivos, uma por item. Duas vivas so por bug de sync:
 * vence a de maior `updatedAt`.
 *
 * Marca mais velha que o ultimo `restock` vivo do item e ignorada. O repor apaga a
 * marca, mas o LWW por linha inteira deixa um aparelho offline (que editou a marca
 * com HLC posterior ao do repor) ressuscitar a marca velha, ja marcada e com a
 * quantidade antiga. A compra encerra a ida ao mercado daquele item; so uma marca
 * escrita depois dela conta. Restock desfeito (morto) nao encerra nada.
 */
function liveMarks(
  items: ReadonlyMap<Ulid, Item>,
  movements: readonly Movement[],
  marks: readonly ListMark[],
): Map<Ulid, ListMark> {
  const lastRestock = new Map<Ulid, string>();
  for (const m of movements) {
    if (!isAlive(m) || m.reason !== "restock") continue;
    const seen = lastRestock.get(m.itemId);
    if (seen === undefined || compareHlc(m.updatedAt, seen) > 0) {
      lastRestock.set(m.itemId, m.updatedAt);
    }
  }
  const out = new Map<Ulid, ListMark>();
  for (const mark of marks) {
    if (!isAlive(mark) || !items.has(mark.itemId)) continue;
    const restocked = lastRestock.get(mark.itemId);
    if (restocked !== undefined && compareHlc(mark.updatedAt, restocked) < 0) continue;
    const seen = out.get(mark.itemId);
    if (seen === undefined || compareHlc(mark.updatedAt, seen.updatedAt) > 0) {
      out.set(mark.itemId, mark);
    }
  }
  return out;
}

/**
 * `liveMarkOf` para varios itens de uma vez: uma passada nos movimentos e nas
 * marcas em vez de uma por item. Itens apagados ficam de fora.
 */
export function liveMarksByItem(
  items: readonly Item[],
  movements: readonly Movement[],
  marks: readonly ListMark[],
): Map<Ulid, ListMark> {
  const alive = new Map<Ulid, Item>();
  for (const item of items) if (isAlive(item)) alive.set(item.id, item);
  return liveMarks(alive, movements, marks);
}

/**
 * Marca viva do item, ja sem a marca velha demais (regra do repor) e sem a apagada.
 * Use esta funcao, nunca um find cru em `marks`.
 */
export function liveMarkOf(
  item: Item,
  movements: readonly Movement[],
  marks: readonly ListMark[],
): ListMark | undefined {
  return liveMarks(new Map([[item.id, item]]), movements, marks).get(item.id);
}

/** A lista de compras: projeção pura da despensa, das marcas e dos pedidos. Nada e gravado. */
export function shoppingList(input: {
  items: readonly Item[];
  movements: readonly Movement[];
  prices: readonly Price[];
  marks: readonly ListMark[];
  extras: readonly ListExtra[];
  autoList: boolean;
}): ShoppingList {
  const qty = quantities(input.movements);
  const alive = new Map<Ulid, Item>();
  for (const item of input.items) if (isAlive(item)) alive.set(item.id, item);
  const marks = liveMarks(alive, input.movements, input.marks);

  const auto: ShoppingEntry[] = [];
  const house: ShoppingEntry[] = [];
  for (const item of alive.values()) {
    const q = qty.get(item.id) ?? 0;
    const isAuto = input.autoList && item.min > 0 && q < item.min;
    const mark = marks.get(item.id);
    const pinned = mark?.pinned === 1;
    if (!isAuto && !pinned) continue;
    const entry: ShoppingEntry = {
      key: `item:${item.id}`,
      kind: "item",
      id: item.id,
      section: isAuto ? "auto" : "house",
      name: item.name,
      size: item.size,
      unit: item.unit,
      qty: mark?.qty ?? item.usualQty,
      suggestion: item.usualQty,
      have: Math.max(0, q),
      reason: isAuto ? (q <= 0 ? "out" : "low") : null,
      requestedBy: pinned && !isAuto ? (mark?.pinnedBy ?? null) : null,
      pinned,
      checked: mark?.checked === 1,
      priceMinor: mark?.priceMinor ?? null,
      estimateMinor: mark?.priceMinor == null ? lastPriceOf(item.id, input.prices) : null,
    };
    (isAuto ? auto : house).push(entry);
  }
  for (const extra of input.extras) {
    if (!isAlive(extra)) continue;
    house.push({
      key: `extra:${extra.id}`,
      kind: "extra",
      id: extra.id,
      section: "house",
      name: extra.name,
      size: "",
      unit: "",
      qty: extra.qty ?? 1,
      suggestion: 1,
      have: null,
      reason: null,
      requestedBy: requesterOf(extra),
      pinned: false,
      checked: extra.checked === 1,
      priceMinor: extra.priceMinor,
      estimateMinor: null,
    });
  }

  auto.sort((a, b) => Number(b.reason === "out") - Number(a.reason === "out") || byName(a, b));
  house.sort(byName);

  let done = 0;
  let remainingMinor = 0;
  let unpriced = 0;
  for (const e of [...auto, ...house]) {
    if (e.checked) {
      done += 1;
      continue;
    }
    const unit = unitPriceOf(e);
    if (unit === null) unpriced += 1;
    else remainingMinor += e.qty * unit;
  }
  return { auto, house, done, total: auto.length + house.length, remainingMinor, unpriced };
}

/**
 * Para o CTA do Detalhe: na lista automatica (preferencia ligada), fixado, ou fora.
 * O chamador passa `liveMarkOf(...)`, nunca um find cru: marca ressuscitada pelo sync
 * depois de um repor nao pode mostrar "fixado" onde a lista nao mostra.
 */
export function listStatusOf(
  item: Item,
  qty: number,
  mark: ListMark | undefined,
  autoList: boolean,
): ListStatus {
  if (autoList && isAlive(item) && item.min > 0 && qty < item.min) return "auto";
  if (isAlive(mark) && mark.pinned === 1) return "pinned";
  return "off";
}
