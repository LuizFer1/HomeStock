import type { BaseRow } from "./base";
import type { Item } from "./item";
import type { Movement, Price } from "./movement";

/**
 * Construtores de linha para teste de projecao. O sufixo `.fake` o mantem fora
 * do `include` do Vitest.
 */
let seq = 0;

function base(overrides: Partial<BaseRow> = {}): BaseRow {
  seq += 1;
  return {
    id: `R${String(seq).padStart(25, "0")}`,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: `${String(seq).padStart(13, "0")}-0000-${"0".repeat(26)}`,
    deletedAt: null,
    dirty: 0,
    authorId: null,
    ...overrides,
  };
}

export function fakeItem(overrides: Partial<Item> = {}): Item {
  return {
    ...base(),
    name: "Café em grãos",
    size: "Torrado 1 kg",
    unit: "pct",
    categoryId: "C",
    locationId: null,
    min: 2,
    usualQty: 3,
    expiresAt: null,
    ean: null,
    photo: null,
    ...overrides,
  };
}

export function fakeMovement(
  itemId: string,
  delta: number,
  overrides: Partial<Movement> = {},
): Movement {
  return { ...base(), itemId, delta, reason: delta > 0 ? "restock" : "use", ...overrides };
}

export function fakePrice(
  itemId: string,
  unitPriceMinor: number,
  on: string,
  overrides: Partial<Price> = {},
): Price {
  return { ...base(), itemId, unitPriceMinor, qty: 1, on, movementId: "M", ...overrides };
}
