import type { Ulid } from "../ids/ulid";
import type { BaseRow } from "./base";

/**
 * Item da despensa. LWW por linha.
 *
 * Nao existe quantidade, status nem ultimo preco aqui, de proposito: os tres
 * sao projecoes. Gravados no item, disputariam o LWW com os movimentos e os
 * precos de outro celular, e um consumo se perderia em silencio.
 */
export interface Item extends BaseRow {
  name: string;
  /** Texto livre: "Torrado 1 kg". */
  size: string;
  /** "pct", "un", "rolo". As quantidades sao inteiros nesta unidade. */
  unit: string;
  categoryId: Ulid;
  locationId: Ulid | null;
  /** 0 = o item fica na despensa sem entrar na lista sozinho. */
  min: number;
  /** Sugestao quando o item entra na lista; >= 1. */
  usualQty: number;
  /** 'YYYY-MM-DD' da unidade que vence primeiro. */
  expiresAt: string | null;
  ean: string | null;
  /** Data URL ja redimensionada no aparelho. */
  photo: string | null;
}

export interface Category extends BaseRow {
  name: string;
}

export interface Location extends BaseRow {
  name: string;
}
