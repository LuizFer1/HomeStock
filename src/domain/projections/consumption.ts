import type { Ulid } from "../ids/ulid";
import { isAlive } from "../model/base";
import type { Movement } from "../model/movement";

const DAY_MS = 86_400_000;

/** Quantos intervalos o grafico do Detalhe mostra. */
export const CONSUMPTION_BARS = 8;

export interface Consumption {
  /** Dias que cada unidade durou, do mais antigo ao mais novo; no maximo 8. */
  daysPerUnit: number[];
  /** Media de dias por unidade sobre todo o historico; null com menos de 2 consumos. */
  average: number | null;
}

/**
 * Cada consumo dura ate o consumo seguinte. Um `use` de 2 unidades seguido de
 * outro 10 dias depois diz que cada unidade durou 5 dias. O ultimo consumo
 * ainda nao terminou, entao nao entra na conta.
 */
export function consumptionOf(itemId: Ulid, movements: readonly Movement[]): Consumption {
  const uses = movements
    .filter((m) => isAlive(m) && m.itemId === itemId && m.reason === "use")
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0));

  const daysPerUnit: number[] = [];
  let totalDays = 0;
  let totalUnits = 0;

  for (let i = 0; i + 1 < uses.length; i += 1) {
    const current = uses[i];
    const next = uses[i + 1];
    if (current === undefined || next === undefined) continue;
    const days = (Date.parse(next.createdAt) - Date.parse(current.createdAt)) / DAY_MS;
    const units = Math.abs(current.delta);
    daysPerUnit.push(days / units);
    totalDays += days;
    totalUnits += units;
  }

  return {
    daysPerUnit: daysPerUnit.slice(-CONSUMPTION_BARS),
    average: totalUnits > 0 ? totalDays / totalUnits : null,
  };
}

/** "Acaba em ~N dias". null sem media; 0 se ja acabou. */
export function runsOutIn(qty: number, average: number | null): number | null {
  if (average === null) return null;
  if (qty <= 0) return 0;
  return Math.round(qty * average);
}
