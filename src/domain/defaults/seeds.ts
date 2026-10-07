import { formatHlc } from "../clock/hlc";
import { stableEntityId } from "../ids/stable-id";
import type { Category, Location } from "../model/item";

/**
 * O menor HLC que existe. Semente nasce com ele para qualquer edicao real
 * vencer o LWW, mesmo que o outro celular semeie depois.
 */
export const SEED_HLC = formatHlc({ millis: 0, counter: 0, deviceId: "0".repeat(26) });

/**
 * Id derivado do nome-chave, igual em todo aparelho. Com ULID aleatorio, cada
 * celular semearia a sua "Despensa" e o HubStock somaria uma copia por celular
 * (a licao dos padroes do HomeFinance).
 */
export const CATEGORY_SEEDS = [
  ["despensa", "Despensa"],
  ["limpeza", "Limpeza"],
  ["higiene", "Higiene"],
] as const;

export const LOCATION_SEEDS = [
  ["armario", "Armário"],
  ["geladeira", "Geladeira"],
  ["freezer", "Freezer"],
  ["banheiro", "Banheiro"],
  ["lavanderia", "Lavanderia"],
  ["area-de-servico", "Área de serviço"],
] as const;

function seedRow(kind: string, key: string, name: string): Category {
  return {
    id: stableEntityId(`${kind}:${key}`),
    createdAt: new Date(0).toISOString(),
    updatedAt: SEED_HLC,
    deletedAt: null,
    // Nasce limpa: todo aparelho tem a mesma semente, nao ha o que enviar.
    dirty: 0,
    authorId: null,
    name,
  };
}

export function seedCategories(): Category[] {
  return CATEGORY_SEEDS.map(([key, name]) => seedRow("category", key, name));
}

export function seedLocations(): Location[] {
  return LOCATION_SEEDS.map(([key, name]) => seedRow("location", key, name));
}

export const DEFAULT_CATEGORY_ID = stableEntityId("category:despensa");
