import type { BaseRow } from "./base";

/**
 * Pedido da casa: um nome na lista que nao mora na despensa. Marcar como
 * comprado nao cria estoque.
 */
export interface ListExtra extends BaseRow {
  name: string;
  qty: number | null;
  priceMinor: number | null;
  checked: 0 | 1;
}
