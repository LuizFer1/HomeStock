import { describe, expect, it } from "vitest";
import type { ListExtra } from "../model/list-extra";
import type { ListMark } from "../model/list-mark";
import { fakeItem, fakeMovement, fakePrice } from "../model/row.fake";
import { listStatusOf, liveMarkOf, shoppingList, unitPriceOf } from "./shopping";

const hlc = (n: number) => `${String(n).padStart(13, "0")}-0000-${"0".repeat(26)}`;

function mark(itemId: string, overrides: Partial<ListMark> = {}): ListMark {
  return {
    id: `K${itemId}`,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: hlc(900),
    deletedAt: null,
    dirty: 0,
    authorId: null,
    itemId,
    checked: 0,
    qty: null,
    priceMinor: null,
    pinned: 0,
    pinnedBy: null,
    ...overrides,
  };
}

function extra(id: string, name: string, overrides: Partial<ListExtra> = {}): ListExtra {
  return {
    id,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: hlc(900),
    deletedAt: null,
    dirty: 0,
    authorId: "ANA",
    name,
    qty: null,
    priceMinor: null,
    checked: 0,
    requestedBy: "ANA",
    ...overrides,
  };
}

function list(over: Partial<Parameters<typeof shoppingList>[0]> = {}) {
  return shoppingList({
    items: [],
    movements: [],
    prices: [],
    marks: [],
    extras: [],
    autoList: true,
    ...over,
  });
}

describe("shoppingList: lista automatica", () => {
  it("item abaixo do minimo entra, esgotado vira out, no minimo sai", () => {
    const item = fakeItem({ min: 2, usualQty: 3 });
    const low = list({ items: [item], movements: [fakeMovement(item.id, 1)] });
    expect(low.auto).toHaveLength(1);
    expect(low.auto[0]).toMatchObject({
      key: `item:${item.id}`,
      kind: "item",
      section: "auto",
      reason: "low",
      qty: 3,
      suggestion: 3,
      have: 1,
    });
    expect(list({ items: [item] }).auto[0]).toMatchObject({ reason: "out", have: 0 });
    expect(list({ items: [item], movements: [fakeMovement(item.id, 2)] }).auto).toEqual([]);
  });

  it("min 0 e item apagado ficam fora", () => {
    const none = fakeItem({ min: 0 });
    const gone = fakeItem({ deletedAt: hlc(5) });
    expect(list({ items: [none, gone] }).auto).toEqual([]);
  });

  it("have nunca e negativo", () => {
    const item = fakeItem();
    const l = list({ items: [item], movements: [fakeMovement(item.id, -1)] });
    expect(l.auto[0]?.have).toBe(0);
  });

  it("autoList desligado esvazia auto; fixado vai para house com pinnedBy", () => {
    const item = fakeItem();
    const l = list({
      items: [item],
      autoList: false,
      marks: [mark(item.id, { pinned: 1, pinnedBy: "RAFA" })],
    });
    expect(l.auto).toEqual([]);
    expect(l.house[0]).toMatchObject({
      section: "house",
      reason: null,
      requestedBy: "RAFA",
      pinned: true,
    });
  });

  it("fixado acima do minimo vai para house", () => {
    const item = fakeItem();
    const l = list({
      items: [item],
      movements: [fakeMovement(item.id, 5)],
      marks: [mark(item.id, { pinned: 1, pinnedBy: "ANA" })],
    });
    expect(l.auto).toEqual([]);
    expect(l.house).toHaveLength(1);
  });

  it("fixado abaixo do minimo com autoList ligado aparece so em auto", () => {
    const item = fakeItem();
    const l = list({ items: [item], marks: [mark(item.id, { pinned: 1, pinnedBy: "ANA" })] });
    expect(l.house).toEqual([]);
    expect(l.auto).toHaveLength(1);
    expect(l.auto[0]).toMatchObject({ pinned: true, requestedBy: null });
  });

  it("marca viva nao fixada de item acima do minimo e ignorada", () => {
    const item = fakeItem();
    const l = list({
      items: [item],
      movements: [fakeMovement(item.id, 5)],
      marks: [mark(item.id, { checked: 1 })],
    });
    expect(l.auto).toEqual([]);
    expect(l.house).toEqual([]);
    expect(l.total).toBe(0);
  });

  it("marca de quantidade e preco; sem preco digitado estima pelo ultimo preco", () => {
    const item = fakeItem();
    const withMark = list({ items: [item], marks: [mark(item.id, { qty: 2, priceMinor: 4290 })] });
    expect(withMark.auto[0]).toMatchObject({ qty: 2, priceMinor: 4290, estimateMinor: null });
    const est = list({
      items: [item],
      prices: [fakePrice(item.id, 3990, "2026-10-01")],
      marks: [mark(item.id, { checked: 1 })],
    });
    expect(est.auto[0]).toMatchObject({ priceMinor: null, estimateMinor: 3990, checked: true });
  });

  it("duas marcas vivas do mesmo item: vence a de maior updatedAt", () => {
    const item = fakeItem();
    const l = list({
      items: [item],
      marks: [
        mark(item.id, { id: "K1", qty: 5, updatedAt: hlc(910) }),
        mark(item.id, { id: "K2", qty: 7, updatedAt: hlc(920) }),
      ],
    });
    expect(l.auto[0]?.qty).toBe(7);
  });
});

describe("shoppingList: marca velha depois de um repor", () => {
  const item = fakeItem();
  const markWith = (updatedAt: string) => mark(item.id, { pinned: 1, pinnedBy: "ANA", updatedAt });
  const stocked = (restock: ReturnType<typeof fakeMovement>) => [fakeMovement(item.id, 5), restock];

  it("marca atualizada antes do restock vivo e ignorada", () => {
    const restock = fakeMovement(item.id, 1, { reason: "restock", updatedAt: hlc(500) });
    const l = list({ items: [item], movements: stocked(restock), marks: [markWith(hlc(400))] });
    expect(l.house).toEqual([]);
  });

  it("marca atualizada depois do restock e mantida", () => {
    const restock = fakeMovement(item.id, 1, { reason: "restock", updatedAt: hlc(500) });
    const l = list({ items: [item], movements: stocked(restock), marks: [markWith(hlc(600))] });
    expect(l.house).toHaveLength(1);
  });

  it("restock desfeito nao conta: a marca volta a valer", () => {
    const restock = fakeMovement(item.id, 1, {
      reason: "restock",
      updatedAt: hlc(500),
      deletedAt: hlc(550),
    });
    const l = list({ items: [item], movements: stocked(restock), marks: [markWith(hlc(400))] });
    expect(l.house).toHaveLength(1);
  });

  it("vale o restock vivo mais recente", () => {
    const old = fakeMovement(item.id, 1, { reason: "restock", updatedAt: hlc(100) });
    const recent = fakeMovement(item.id, 1, { reason: "restock", updatedAt: hlc(700) });
    const l = list({
      items: [item],
      movements: [fakeMovement(item.id, 5), old, recent],
      marks: [markWith(hlc(400))],
    });
    expect(l.house).toEqual([]);
  });
});

describe("shoppingList: itens e marcas apagados", () => {
  it("item apagado ignora marca e fixado", () => {
    const item = fakeItem({ deletedAt: hlc(5) });
    const l = list({ items: [item], marks: [mark(item.id, { pinned: 1, pinnedBy: "ANA" })] });
    expect(l.total).toBe(0);
  });

  it("marca apagada nao fixa", () => {
    const item = fakeItem();
    const l = list({
      items: [item],
      autoList: false,
      marks: [mark(item.id, { pinned: 1, deletedAt: hlc(7) })],
    });
    expect(l.total).toBe(0);
  });
});

describe("shoppingList: pedidos", () => {
  it("qty null vale 1; sem requestedBy cai em authorId; apagado sai", () => {
    const { requestedBy: _omit, ...rest } = extra("E1", "Banana", { authorId: "RAFA" });
    const old = rest as ListExtra;
    const l = list({ extras: [old, extra("E2", "Pão", { deletedAt: hlc(8) })] });
    expect(l.house).toHaveLength(1);
    expect(l.house[0]).toMatchObject({
      key: "extra:E1",
      kind: "extra",
      qty: 1,
      suggestion: 1,
      have: null,
      reason: null,
      requestedBy: "RAFA",
      size: "",
      unit: "",
      estimateMinor: null,
    });
  });

  it("requestedBy gravado vence authorId", () => {
    const l = list({ extras: [extra("E1", "Banana", { authorId: "RAFA", requestedBy: "ANA" })] });
    expect(l.house[0]?.requestedBy).toBe("ANA");
  });
});

describe("shoppingList: ordem e totais", () => {
  it("esgotado antes de abaixo do minimo, depois nome; house por nome", () => {
    const zeta = fakeItem({ name: "Zeta" });
    const alfa = fakeItem({ name: "Alfa" });
    const beta = fakeItem({ name: "Beta" });
    const l = list({
      items: [zeta, alfa, beta],
      movements: [fakeMovement(alfa.id, 1), fakeMovement(beta.id, 1)],
      extras: [extra("E1", "Banana"), extra("E2", "Açúcar")],
    });
    expect(l.auto.map((e) => e.name)).toEqual(["Zeta", "Alfa", "Beta"]);
    expect(l.house.map((e) => e.name)).toEqual(["Açúcar", "Banana"]);
  });

  it("totais: restante, sem preco, feitos e total", () => {
    const a = fakeItem({ name: "A", usualQty: 2 });
    const b = fakeItem({ name: "B", usualQty: 3 });
    const c = fakeItem({ name: "C", usualQty: 1 });
    const l = list({
      items: [a, b, c],
      prices: [fakePrice(b.id, 3990, "2026-10-01")],
      marks: [mark(a.id, { priceMinor: 4290 }), mark(c.id, { checked: 1, priceMinor: 500 })],
      extras: [extra("E1", "Banana")],
    });
    expect(l).toMatchObject({ remainingMinor: 20550, unpriced: 1, done: 1, total: 4 });
  });
});

describe("unitPriceOf", () => {
  it("digitado, senao estimado, senao null", () => {
    const base = list({ extras: [extra("E1", "x")] }).house[0];
    if (base === undefined) throw new Error("sem linha");
    expect(unitPriceOf({ ...base, priceMinor: 100, estimateMinor: 200 })).toBe(100);
    expect(unitPriceOf({ ...base, priceMinor: null, estimateMinor: 200 })).toBe(200);
    expect(unitPriceOf(base)).toBeNull();
  });
});

describe("listStatusOf", () => {
  const item = fakeItem();
  it("cada ramo", () => {
    expect(listStatusOf(item, 1, undefined, true)).toBe("auto");
    expect(listStatusOf(item, 5, undefined, true)).toBe("off");
    expect(listStatusOf(item, 5, mark(item.id, { pinned: 1 }), true)).toBe("pinned");
    expect(listStatusOf(item, 5, mark(item.id, { pinned: 1, deletedAt: hlc(3) }), true)).toBe(
      "off",
    );
    expect(listStatusOf(item, 5, mark(item.id, { checked: 1 }), true)).toBe("off");
    expect(listStatusOf(item, 1, mark(item.id, { pinned: 1 }), false)).toBe("pinned");
    expect(listStatusOf(item, 1, undefined, false)).toBe("off");
    expect(listStatusOf(fakeItem({ min: 0 }), 0, undefined, true)).toBe("off");
    expect(listStatusOf(fakeItem({ deletedAt: hlc(1) }), 0, undefined, true)).toBe("off");
  });
});

describe("liveMarkOf", () => {
  const item = fakeItem();
  const m = (updatedAt: string) => mark(item.id, { pinned: 1, updatedAt });

  it("marca mais velha que restock vivo e undefined; mais nova volta", () => {
    const restock = fakeMovement(item.id, 1, { reason: "restock", updatedAt: hlc(500) });
    expect(liveMarkOf(item, [restock], [m(hlc(400))])).toBeUndefined();
    expect(liveMarkOf(item, [restock], [m(hlc(600))])?.pinned).toBe(1);
  });

  it("restock desfeito nao conta e marca apagada some", () => {
    const undone = fakeMovement(item.id, 1, {
      reason: "restock",
      updatedAt: hlc(500),
      deletedAt: hlc(550),
    });
    expect(liveMarkOf(item, [undone], [m(hlc(400))])).toBeDefined();
    expect(liveMarkOf(item, [], [{ ...m(hlc(400)), deletedAt: hlc(450) }])).toBeUndefined();
  });
});
