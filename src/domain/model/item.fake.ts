import { DEFAULT_CATEGORY_ID } from "../defaults/seeds";
import type { Draft } from "./base";
import type { Item } from "./item";

/** Item valido para testes; sem Dexie, serve a testes de dominio e de dados. */
export function cafe(overrides: Partial<Draft<Item>> = {}): Draft<Item> {
  return {
    name: "Café em grãos",
    size: "Torrado 1 kg",
    unit: "pct",
    categoryId: DEFAULT_CATEGORY_ID,
    locationId: null,
    min: 2,
    usualQty: 3,
    expiresAt: null,
    ean: "7891234567890",
    photo: null,
    ...overrides,
  };
}
