import type { Ulid } from "../ids/ulid";
import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import type { Movement } from "../model/movement";

const DAY_MS = 86_400_000;

/** Dias de `from` ate `to`, os dois 'YYYY-MM-DD'. Negativo se `to` ja passou. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Quantidade de cada item: soma dos `delta` vivos. Pode ficar negativa depois
 * de um sync (dois celulares consumindo a ultima unidade); quem mostra usa
 * `max(0, q)`, mas a soma fica verdadeira para a proxima reposicao fechar a conta.
 */
export function quantities(movements: readonly Movement[]): Map<Ulid, number> {
  const out = new Map<Ulid, number>();
  for (const m of movements) {
    if (!isAlive(m)) continue;
    out.set(m.itemId, (out.get(m.itemId) ?? 0) + m.delta);
  }
  return out;
}

export function quantityOf(itemId: Ulid, movements: readonly Movement[]): number {
  return quantities(movements).get(itemId) ?? 0;
}

export type PrimaryStatus = "out" | "low" | "exp" | "ok";

export interface ItemStatus {
  out: boolean;
  low: boolean;
  expiring: boolean;
  /** Uma cor so por item: esgotado, depois abaixo do minimo, depois vencendo. */
  primary: PrimaryStatus;
}

export const EXPIRING_DAYS = 3;

export function statusOf(
  item: Item,
  qty: number,
  today: string,
  expDays = EXPIRING_DAYS,
): ItemStatus {
  const out = qty <= 0;
  const low = item.min > 0 && qty < item.min;
  const expiring = item.expiresAt !== null && daysBetween(today, item.expiresAt) <= expDays;
  const primary: PrimaryStatus = out ? "out" : low ? "low" : expiring ? "exp" : "ok";
  return { out, low, expiring, primary };
}

export interface AutoListEntry {
  item: Item;
  qty: number;
  /** A quantidade usual de compra; pode ser editada antes de confirmar. */
  suggestion: number;
}

/**
 * A lista automatica nao e tabela: e a despensa filtrada abaixo do minimo.
 * Entra com `qty < min` e sai sozinha quando a soma volta a `qty >= min`.
 * `min = 0` nunca entra.
 */
export function autoList(items: readonly Item[], movements: readonly Movement[]): AutoListEntry[] {
  const qty = quantities(movements);
  const out: AutoListEntry[] = [];
  for (const item of items) {
    if (!isAlive(item) || item.min <= 0) continue;
    const q = qty.get(item.id) ?? 0;
    if (q < item.min) out.push({ item, qty: q, suggestion: item.usualQty });
  }
  return out;
}

/** Fracao de itens vivos em dia, de 0 a 1; null sem itens. */
export function health(statuses: readonly ItemStatus[]): number | null {
  if (statuses.length === 0) return null;
  return statuses.filter((s) => s.primary === "ok").length / statuses.length;
}
