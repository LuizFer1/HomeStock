import { stableEntityId } from "../ids/stable-id";
import type { Ulid } from "../ids/ulid";
import { EXPIRING_DAYS } from "../projections/stock";
import { type BaseRow, isAlive } from "./base";

/** Preferencias da casa. Sincronizam: o handoff as poe em `household`. */
export interface PrefValues {
  /** "" = a UI mostra "Casa de {nome do morador local}". */
  houseName: string;
  alertLow: boolean;
  alertExpiring: boolean;
  /** Inteiro 1..14. */
  expiringDays: number;
  alertActivity: boolean;
  autoList: boolean;
  /** "" = nenhum. */
  preferredStore: string;
}

export type PrefKey = keyof PrefValues;
export type PrefValue = PrefValues[PrefKey];

/**
 * Uma linha por chave, nao uma linha da casa: com LWW por linha, um celular
 * desligando um alerta e outro renomeando a casa perderiam uma das edicoes.
 */
export interface PrefRow extends BaseRow {
  key: PrefKey;
  value: PrefValue;
}

export const DEFAULT_PREFS: Readonly<PrefValues> = {
  houseName: "",
  alertLow: true,
  alertExpiring: true,
  expiringDays: EXPIRING_DAYS,
  alertActivity: true,
  autoList: true,
  preferredStore: "",
};

export const EXPIRING_DAY_OPTIONS = [1, 3, 5, 7] as const;
export const MAX_EXPIRING_DAYS = 14;
export const MAX_PREF_TEXT = 60;

/** Igual em todo aparelho: duas escritas da mesma chave caem na mesma linha. */
export function prefId(key: PrefKey): Ulid {
  return stableEntityId(`pref:${key}`);
}

export function isPrefKey(key: string): key is PrefKey {
  return Object.hasOwn(DEFAULT_PREFS, key);
}

function acceptable(key: PrefKey, value: unknown): boolean {
  if (typeof value !== typeof DEFAULT_PREFS[key]) return false;
  if (key === "expiringDays") {
    return (
      Number.isInteger(value) && (value as number) >= 1 && (value as number) <= MAX_EXPIRING_DAYS
    );
  }
  return true;
}

/**
 * Padroes com as linhas vivas por cima. Linha de chave desconhecida ou de tipo
 * errado (outra versao do app, via sync) e ignorada: preferencia nunca derruba a tela.
 */
export function prefsFrom(rows: readonly PrefRow[]): PrefValues {
  const out: PrefValues = { ...DEFAULT_PREFS };
  for (const row of rows) {
    if (!isAlive(row) || !isPrefKey(row.key) || !acceptable(row.key, row.value)) continue;
    (out as Record<PrefKey, PrefValue>)[row.key] = row.value;
  }
  return out;
}

/** Valida e limpa antes de gravar. Lanca em valor invalido. */
export function normalizePref<K extends PrefKey>(key: K, value: PrefValues[K]): PrefValues[K] {
  const clean = typeof value === "string" ? (value.trim() as PrefValues[K]) : value;
  if (!acceptable(key, clean)) throw new Error(`Preferencia ${key} invalida: ${String(value)}`);
  if (typeof clean === "string" && clean.length > MAX_PREF_TEXT) {
    throw new Error(`Preferencia ${key} passa de ${MAX_PREF_TEXT} caracteres`);
  }
  return clean;
}
