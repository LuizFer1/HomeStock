import type { Ulid } from "../ids/ulid";
import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import type { Movement, Price } from "../model/movement";
import { quantities } from "./stock";

/** Preco unitario mais recente: maior `on`, desempate pelo HLC. null sem historico. */
export function lastPriceOf(itemId: Ulid, prices: readonly Price[]): number | null {
  let best: Price | undefined;
  for (const p of prices) {
    if (!isAlive(p) || p.itemId !== itemId) continue;
    if (
      best === undefined ||
      p.on > best.on ||
      (p.on === best.on && p.updatedAt > best.updatedAt)
    ) {
      best = p;
    }
  }
  return best?.unitPriceMinor ?? null;
}

/** Valor em estoque, em centavos: quantidade (nunca negativa) vezes o ultimo preco. */
export function stockValue(
  items: readonly Item[],
  movements: readonly Movement[],
  prices: readonly Price[],
): number {
  const qty = quantities(movements);
  let total = 0;
  for (const item of items) {
    if (!isAlive(item)) continue;
    const price = lastPriceOf(item.id, prices);
    if (price === null) continue;
    total += Math.max(0, qty.get(item.id) ?? 0) * price;
  }
  return total;
}
