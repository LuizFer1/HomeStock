import { isAlive } from "./base";
import type { Item } from "./item";

/**
 * Codigo lido pela camera -> EAN gravavel. 13 e 8 digitos passam; 12 (UPC-A)
 * ganha o 0 do EAN-13: o mesmo pacote lido como UPC-A por um leitor e EAN-13
 * por outro nao pode virar dois itens. Qualquer outra coisa e leitura ruim.
 */
export function scannedToEan(raw: string): string | null {
  if (!/^\d+$/.test(raw)) return null;
  if (raw.length === 13 || raw.length === 8) return raw;
  if (raw.length === 12) return `0${raw}`;
  return null;
}

/** Formas equivalentes para busca: o proprio e, se houver, a com/sem o 0 do UPC-A. Sem repetidos. */
export function eanKeys(ean: string): string[] {
  if (ean.length === 13 && ean.startsWith("0")) return [ean, ean.slice(1)];
  if (ean.length === 12) return [ean, `0${ean}`];
  return [ean];
}

/**
 * Item vivo com o codigo em qualquer forma de `eanKeys`. O indice nao e unico
 * (o sync traz duplicata): o primeiro pelo nome pt-BR, para ser deterministico.
 */
export function itemWithEan(items: readonly Item[], ean: string): Item | null {
  const keys = eanKeys(ean);
  const found = items
    .filter((item) => isAlive(item) && item.ean !== null && keys.includes(item.ean))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return found[0] ?? null;
}
