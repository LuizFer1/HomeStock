import type { Ulid } from "../ids/ulid";
import type { BaseRow } from "./base";
import { MAX_ITEM_COUNT } from "./item";

/**
 * Pedido da casa: um nome na lista que nao mora na despensa. Marcar como
 * comprado nao cria estoque.
 */
export interface ListExtra extends BaseRow {
  name: string;
  /** null conta 1 no total. */
  qty: number | null;
  /** Preco unitario. */
  priceMinor: number | null;
  checked: 0 | 1;
  /** Quem pediu, gravado na criacao. Linha antiga nao tem o campo: leia por `requesterOf`. */
  requestedBy?: Ulid | null;
}

/** Quem pediu. authorId muda a cada escrita, entao so serve para a linha antiga sem o campo. */
export function requesterOf(extra: ListExtra): Ulid | null {
  return extra.requestedBy ?? extra.authorId;
}

export const MAX_EXTRA_NAME = 60;

/** trim, 1..60. As mensagens aparecem na tela. */
export function normalizeExtraName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed === "") throw new Error("Dê um nome ao pedido.");
  if (trimmed.length > MAX_EXTRA_NAME) {
    throw new Error(`Use até ${MAX_EXTRA_NAME} letras no pedido.`);
  }
  return trimmed;
}

/**
 * qty null ou inteiro 1..MAX_ITEM_COUNT; priceMinor null ou inteiro >= 0.
 * Lanca com mensagem interna: a tela so manda valores ja mascarados. A marca de
 * item da despensa usa as mesmas regras.
 */
export function assertExtraNumbers(qty: number | null, priceMinor: number | null): void {
  if (qty !== null && (!Number.isInteger(qty) || qty < 1 || qty > MAX_ITEM_COUNT)) {
    throw new Error(`Quantidade da lista exige inteiro 1..${MAX_ITEM_COUNT}, recebeu ${qty}`);
  }
  if (priceMinor !== null && (!Number.isInteger(priceMinor) || priceMinor < 0)) {
    throw new Error(`Preco exige centavos inteiros >= 0, recebeu ${priceMinor}`);
  }
}
