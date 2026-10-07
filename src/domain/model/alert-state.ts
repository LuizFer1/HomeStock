import { stableEntityId } from "../ids/stable-id";
import type { Ulid } from "../ids/ulid";
import { type BaseRow, isAlive } from "./base";

/**
 * "Resolvido" de um alerta. Linha viva = resolvido; deletedAt = reaberto. Id
 * estavel pela chave: dois aparelhos resolvendo o mesmo alerta escrevem a mesma
 * linha e o sync converge. O alerta em si nunca e gravado: e projecao (alertsOf).
 */
export interface AlertState extends BaseRow {
  key: string;
}

export const MAX_ALERT_KEY = 200;
const ALERT_KEY = /^[a-z]+(:[0-9A-Za-z_-]+)+$/;

/** Igual em todo aparelho para a mesma chave. */
export function alertStateId(key: string): Ulid {
  return stableEntityId(`alert:${key}`);
}

/** Lanca (mensagem interna, sem acento) em chave vazia, longa ou fora do formato. */
export function normalizeAlertKey(key: string): string {
  if (
    typeof key !== "string" ||
    key.length < 1 ||
    key.length > MAX_ALERT_KEY ||
    !ALERT_KEY.test(key)
  ) {
    throw new Error(`Chave de alerta invalida: ${key}`);
  }
  return key;
}

/** Chaves das linhas vivas. */
export function resolvedKeys(rows: readonly AlertState[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) if (isAlive(row)) keys.add(row.key);
  return keys;
}
