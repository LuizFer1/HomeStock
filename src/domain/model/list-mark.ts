import { stableEntityId } from "../ids/stable-id";
import type { Ulid } from "../ids/ulid";
import type { BaseRow } from "./base";
import type { Item } from "./item";
import { assertExtraNumbers } from "./list-extra";

/**
 * Marca de um item da despensa na lista de compras. Uma linha LWW por item,
 * id estavel: dois aparelhos marcando o mesmo item escrevem a mesma linha, e o
 * sync converge em vez de somar duas marcas. Fora do Item para marcar no
 * mercado nao disputar LWW com a edicao do minimo feita em casa.
 */
export interface ListMark extends BaseRow {
  itemId: Ulid;
  checked: 0 | 1;
  /** Quantidade a comprar editada; null = compra usual do item. */
  qty: number | null;
  /** Preco unitario digitado; null = nao informado (o ultimo preco so estima). */
  priceMinor: number | null;
  /** 1 = pedido a mao pelo Detalhe, mesmo acima do minimo. */
  pinned: 0 | 1;
  /** Quem fixou; null sem fixar. authorId muda a cada escrita, este nao. */
  pinnedBy: Ulid | null;
}

export type ListMarkPatch = Partial<Pick<ListMark, "checked" | "qty" | "priceMinor" | "pinned">>;

/** Igual em todo aparelho para o mesmo item. */
export function listMarkId(itemId: Ulid): Ulid {
  return stableEntityId(`listMark:${itemId}`);
}

function assertFlag(value: unknown, what: string): void {
  if (value !== undefined && value !== 0 && value !== 1) {
    throw new Error(`${what} exige 0 ou 1, recebeu ${String(value)}`);
  }
}

/** Copia validada. Lanca (mensagem interna, sem acento) em valor invalido. */
export function normalizeListMarkPatch(patch: ListMarkPatch): ListMarkPatch {
  assertFlag(patch.checked, "checked");
  assertFlag(patch.pinned, "pinned");
  // Mesmas regras do pedido avulso; undefined (ausente) vale como null aqui.
  assertExtraNumbers(patch.qty ?? null, patch.priceMinor ?? null);
  // undefined explicito significa "inalterado": a chave sai para o spread nao apagar o campo.
  return Object.fromEntries(
    Object.entries(patch).filter(([, value]) => value !== undefined),
  ) as ListMarkPatch;
}

/**
 * Marca nao fixada de item que ja saiu da lista automatica. Sem limpar, a
 * proxima vez que o item ficasse abaixo do minimo ela renasceria marcada.
 */
export function markIsStale(item: Item, qty: number, mark: ListMark): boolean {
  return mark.pinned === 0 && (item.min <= 0 || qty >= item.min);
}
