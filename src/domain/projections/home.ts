import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import type { Movement, Price } from "../model/movement";
import { health, quantities, statusOf } from "./stock";
import { stockValue } from "./value";

export interface HomeSummary {
  /** Itens vivos. */
  items: number;
  /** Itens com primary "ok". */
  ok: number;
  /** health(statuses); null sem itens. */
  health: number | null;
  /** stockValue, em centavos. */
  valueMinor: number;
  /** primary "out" ou "low". */
  runningOut: number;
  /** qty > 0 e status.expiring. */
  expiring: number;
}

/** Os numeros do Inicio numa passada; fatos do estoque, nao dependem dos switches de alerta. */
export function homeSummary(input: {
  items: readonly Item[];
  movements: readonly Movement[];
  prices: readonly Price[];
  today: string;
  expDays: number;
}): HomeSummary {
  const qty = quantities(input.movements);
  const statuses = [];
  let runningOut = 0;
  let expiring = 0;
  for (const item of input.items) {
    if (!isAlive(item)) continue;
    const q = Math.max(0, qty.get(item.id) ?? 0);
    const status = statusOf(item, q, input.today, input.expDays);
    statuses.push(status);
    if (status.primary === "out" || status.primary === "low") runningOut += 1;
    if (q > 0 && status.expiring) expiring += 1;
  }
  return {
    items: statuses.length,
    ok: statuses.filter((s) => s.primary === "ok").length,
    health: health(statuses),
    valueMinor: stockValue(input.items, input.movements, input.prices),
    runningOut,
    expiring,
  };
}
