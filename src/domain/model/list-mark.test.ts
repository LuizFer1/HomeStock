import { describe, expect, it } from "vitest";
import { type ListMark, listMarkId, markIsStale, normalizeListMarkPatch } from "./list-mark";
import { fakeItem } from "./row.fake";

function mark(overrides: Partial<ListMark> = {}): ListMark {
  return {
    id: listMarkId("I"),
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "0000000000001-0000-dev",
    deletedAt: null,
    dirty: 1,
    authorId: null,
    itemId: "I",
    checked: 1,
    qty: null,
    priceMinor: null,
    pinned: 0,
    pinnedBy: null,
    ...overrides,
  };
}

describe("listMarkId", () => {
  it("e estavel e muda com o item", () => {
    expect(listMarkId("A")).toBe(listMarkId("A"));
    expect(listMarkId("A")).not.toBe(listMarkId("B"));
  });
});

describe("normalizeListMarkPatch", () => {
  it("aceita valores validos sem acrescentar chaves", () => {
    expect(normalizeListMarkPatch({ qty: null })).toEqual({ qty: null });
    expect(normalizeListMarkPatch({ qty: 999 })).toEqual({ qty: 999 });
    expect(normalizeListMarkPatch({ priceMinor: 0 })).toEqual({ priceMinor: 0 });
    expect(normalizeListMarkPatch({})).toEqual({});
    expect(Object.keys(normalizeListMarkPatch({ qty: undefined, checked: 1 }))).toEqual([
      "checked",
    ]);
    expect(normalizeListMarkPatch({ checked: 1, pinned: 0 })).toEqual({ checked: 1, pinned: 0 });
  });

  it("so devolve os campos conhecidos", () => {
    const untyped = { id: "X", itemId: "Y", deletedAt: "h", checked: 1, qty: 2 };
    expect(normalizeListMarkPatch(untyped as never)).toEqual({ checked: 1, qty: 2 });
  });

  it("recusa valores invalidos", () => {
    for (const qty of [0, 1000, 1.5]) {
      expect(() => normalizeListMarkPatch({ qty })).toThrow(/Quantidade da lista/);
    }
    for (const priceMinor of [-1, 1.5]) {
      expect(() => normalizeListMarkPatch({ priceMinor })).toThrow(/Preco/);
    }
    expect(() => normalizeListMarkPatch({ checked: 2 as never })).toThrow();
    expect(() => normalizeListMarkPatch({ pinned: 2 as never })).toThrow();
  });
});

describe("markIsStale", () => {
  const item = fakeItem({ min: 2 });

  it("marca de item abaixo do minimo nao e velha", () => {
    expect(markIsStale(item, 1, mark())).toBe(false);
  });

  it("item no minimo ou sem minimo deixa a marca velha", () => {
    expect(markIsStale(item, 2, mark())).toBe(true);
    expect(markIsStale(fakeItem({ min: 0 }), 0, mark())).toBe(true);
  });

  it("marca fixada nunca e velha", () => {
    expect(markIsStale(item, 5, mark({ pinned: 1 }))).toBe(false);
  });
});
