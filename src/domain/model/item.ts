import type { Ulid } from "../ids/ulid";
import type { BaseRow, Draft } from "./base";
import { isPhotoDataUrl } from "./member";

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

export const MAX_ITEM_NAME = 60;
export const MAX_ITEM_SIZE = 40;
export const MAX_ITEM_UNIT = 12;
export const MAX_ITEM_COUNT = 999;

function inRange(value: number, min: number): boolean {
  return Number.isInteger(value) && value >= min && value <= MAX_ITEM_COUNT;
}

/** Data de calendario real: ida e volta por UTC recusa 2026-02-30. */
function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const [, y, m, d] = match;
  return (
    new Date(Date.UTC(Number(y), Number(m) - 1, Number(d))).toISOString().slice(0, 10) === value
  );
}

/**
 * Regras de um item valido, para a tela e para a linha que chega pelo sync.
 * Lanca Error com a mensagem que o formulario mostra. Devolve um objeto novo.
 */
export function normalizeItemDraft(draft: Draft<Item>): Draft<Item> {
  const name = draft.name.trim();
  if (name === "") throw new Error("Dê um nome ao item.");
  if (name.length > MAX_ITEM_NAME) throw new Error(`Use até ${MAX_ITEM_NAME} letras no nome.`);

  const size = draft.size.trim();
  if (size.length > MAX_ITEM_SIZE) throw new Error(`Use até ${MAX_ITEM_SIZE} letras no tamanho.`);

  const unit = draft.unit.trim();
  if (unit === "") throw new Error("Informe a unidade.");
  if (unit.length > MAX_ITEM_UNIT) throw new Error(`Use até ${MAX_ITEM_UNIT} letras na unidade.`);

  if (draft.categoryId === "") throw new Error("Escolha uma categoria.");
  const locationId = draft.locationId === "" ? null : draft.locationId;

  if (!inRange(draft.min, 0)) throw new Error(`O mínimo vai de 0 a ${MAX_ITEM_COUNT}.`);
  if (!inRange(draft.usualQty, 1)) {
    throw new Error(`A compra usual vai de 1 a ${MAX_ITEM_COUNT}.`);
  }

  if (draft.expiresAt !== null && !isRealDate(draft.expiresAt)) {
    throw new Error("Data de validade inválida.");
  }

  const rawEan = draft.ean?.replace(/\s+/g, "") ?? "";
  if (rawEan !== "" && !/^\d{8,14}$/.test(rawEan)) {
    throw new Error("O código de barras tem de 8 a 14 dígitos.");
  }

  if (draft.photo !== null && !isPhotoDataUrl(draft.photo)) {
    throw new Error("Formato de foto não aceito.");
  }

  return {
    name,
    size,
    unit,
    categoryId: draft.categoryId,
    locationId,
    min: draft.min,
    usualQty: draft.usualQty,
    expiresAt: draft.expiresAt,
    ean: rawEan === "" ? null : rawEan,
    photo: draft.photo,
  };
}
