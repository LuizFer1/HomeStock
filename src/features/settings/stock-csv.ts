import type { Snapshot } from "../../data/repository";
import { isAlive } from "../../domain/model/base";
import { quantities } from "../../domain/projections/stock";
import { lastPriceOf } from "../../domain/projections/value";

export const CSV_HEADER = [
  "Nome",
  "Tamanho",
  "Unidade",
  "Quantidade",
  "Mínimo",
  "Categoria",
  "Local",
  "Validade",
  "EAN",
  "Último preço (R$)",
] as const;

/**
 * Um campo de texto. Comecar com = + - @ faz o Excel executar a celula como
 * formula, entao ganha `'` na frente; `;` `"` e quebra de linha pedem aspas.
 */
export function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return /[;"\r\n]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}

function reais(cents: number): string {
  return `${Math.floor(cents / 100)},${String(cents % 100).padStart(2, "0")}`;
}

/** Arquivo inteiro: BOM, cabecalho, uma linha por item vivo em ordem de nome, CRLF. */
export function buildStockCsv(
  snapshot: Pick<Snapshot, "items" | "categories" | "locations" | "movements" | "prices">,
): string {
  const { categories, locations, movements, prices } = snapshot;
  const qty = quantities(movements);
  const categoryName = new Map(categories.filter(isAlive).map((c) => [c.id, c.name]));
  const locationName = new Map(locations.filter(isAlive).map((l) => [l.id, l.name]));
  const items = snapshot.items
    .filter(isAlive)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  const lines = items.map((item) => {
    const price = lastPriceOf(item.id, prices);
    return [
      csvField(item.name),
      csvField(item.size),
      csvField(item.unit),
      String(Math.max(0, qty.get(item.id) ?? 0)),
      String(item.min),
      csvField(categoryName.get(item.categoryId) ?? "Sem categoria"),
      csvField(item.locationId === null ? "" : (locationName.get(item.locationId) ?? "")),
      item.expiresAt ?? "",
      csvField(item.ean ?? ""),
      price === null ? "" : reais(price),
    ].join(";");
  });

  // BOM para o Excel pt-BR ler UTF-8; CRLF tambem depois da ultima linha.
  return `﻿${[CSV_HEADER.join(";"), ...lines].map((l) => `${l}\r\n`).join("")}`;
}

/** "homestock-estoque-2026-10-06.csv" */
export function stockCsvFilename(today: string): string {
  return `homestock-estoque-${today}.csv`;
}
