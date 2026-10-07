import "fake-indexeddb/auto";
import { DEFAULT_CATEGORY_ID } from "../domain/defaults/seeds";
import type { RandomChunk } from "../domain/ids/ulid";
import { HomeStockDb } from "./db";
import { type ItemDraft, openRepository, type RepositoryDeps } from "./repository";

/**
 * Banco real sobre `fake-indexeddb`, um nome por chamada para as suites nao se
 * enxergarem. O sufixo `.fake` o mantem fora do `include` do Vitest.
 */
let counter = 0;

export function openTestDb(): HomeStockDb {
  counter += 1;
  return new HomeStockDb(`homestock-test-${counter}-${Date.now()}`);
}

export const TEST_MEMBER_ID = "01J9F3K2M7QX8YB4TVWZ0MEMBR";

/** Aleatoriedade por semente: dois aparelhos de teste nao geram o mesmo id. */
export function seededRandom(seed: number): RandomChunk {
  let state = seed;
  return (count) =>
    Array.from({ length: count }, () => {
      state = (state * 1_103_515_245 + 12_345) % 2_147_483_648;
      return state % 32;
    });
}

/**
 * Relogio que anda 1ms por chamada. Passe o mesmo `clock` a dois aparelhos
 * para a ordem das chamadas ser a ordem dos HLCs.
 */
export function testClock(start = 1_790_000_000_000) {
  let millis = start;
  return () => {
    millis += 1;
    return millis;
  };
}

export async function openTestRepository(
  overrides: Partial<RepositoryDeps> & { seed?: number } = {},
) {
  const db = overrides.db ?? openTestDb();
  const repo = await openRepository({
    db,
    now: overrides.now ?? testClock(),
    randomChunk: overrides.randomChunk ?? seededRandom(overrides.seed ?? 1),
    currentMemberId: overrides.currentMemberId ?? (() => TEST_MEMBER_ID),
    today: overrides.today ?? (() => "2026-10-06"),
  });
  return { db, repo };
}

export function cafe(overrides: Partial<ItemDraft> = {}): ItemDraft {
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
