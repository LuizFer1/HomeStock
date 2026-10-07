import { describe, expect, it } from "vitest";
import type { Category, Location } from "../../domain/model/item";
import { fakeItem, fakeMovement } from "../../domain/model/row.fake";
import {
  buildFilters,
  buildStockRows,
  levelOf,
  type StockRow,
  validFilter,
  visibleRows,
} from "./rows";

const TODAY = "2026-10-06";

function place(id: string, name: string, deletedAt: string | null = null): Category & Location {
  return {
    id,
    name,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "0",
    deletedAt,
    dirty: 0,
    authorId: null,
  };
}

const despensa = place("cat-despensa", "Despensa");
const limpeza = place("cat-limpeza", "Limpeza");
const banheiroCat = place("cat-banheiro", "Banheiro");
const armario = place("loc-armario", "Armário");
const banheiroLoc = place("loc-banheiro", "Banheiro");
const freezer = place("loc-freezer", "Freezer");

const places = {
  categories: [limpeza, despensa, banheiroCat],
  locations: [freezer, banheiroLoc, armario],
};

function rowsOf(...pairs: [ReturnType<typeof fakeItem>, number][]) {
  return buildStockRows(
    {
      items: pairs.map(([item]) => item),
      movements: pairs.map(([item, qty]) => fakeMovement(item.id, qty, { reason: "initial" })),
    },
    TODAY,
    3,
  );
}

describe("levelOf", () => {
  it("segue o markup, com piso 4 e teto 100", () => {
    expect(levelOf(1, 2)).toBe(25);
    expect(levelOf(0, 2)).toBe(4);
    expect(levelOf(9, 2)).toBe(100);
    expect(levelOf(3, 0)).toBe(100);
    expect(levelOf(0, 0)).toBe(4);
  });
});

describe("buildStockRows", () => {
  it("ordena por status (out, low, exp, ok) e depois por nome", () => {
    const rows = rowsOf(
      [fakeItem({ name: "Papel", min: 1 }), 5],
      [fakeItem({ name: "Arroz", min: 1 }), 5],
      [fakeItem({ name: "Leite", min: 1, expiresAt: "2026-10-08" }), 5],
      [fakeItem({ name: "Café", min: 2 }), 1],
      [fakeItem({ name: "Sabão", min: 1 }), 0],
    );
    expect(rows.map((r) => r.item.name)).toEqual(["Sabão", "Café", "Leite", "Arroz", "Papel"]);
    expect(rows.map((r) => r.status.primary)).toEqual(["out", "low", "exp", "ok", "ok"]);
    expect(rows.map((r) => r.note)).toEqual([
      "Esgotado",
      "Abaixo do mínimo",
      "Vence em 2 dias",
      "Em dia",
      "Em dia",
    ]);
    expect(rows[1]?.level).toBe(25);
  });

  it("quantidade negativa vira 0 e esgotado", () => {
    const [row] = rowsOf([fakeItem({ min: 0 }), -2]);
    expect(row?.qty).toBe(0);
    expect(row?.status.primary).toBe("out");
    expect(row?.level).toBe(4);
  });

  it("item apagado fica fora", () => {
    const rows = rowsOf([fakeItem({ deletedAt: "x" }), 1], [fakeItem({ name: "Vivo" }), 1]);
    expect(rows.map((r) => r.item.name)).toEqual(["Vivo"]);
  });

  it("expDays 5 marca vencendo uma validade a 5 dias; com 3 nao", () => {
    const item = fakeItem({ min: 1, expiresAt: "2026-10-11" });
    const data = { items: [item], movements: [fakeMovement(item.id, 4)] };
    expect(buildStockRows(data, TODAY, 5)[0]?.status.primary).toBe("exp");
    expect(buildStockRows(data, TODAY, 3)[0]?.status.primary).toBe("ok");
  });

  it("com consumo, a media entra e a nota diz quanto dura", () => {
    const item = fakeItem({ min: 1 });
    const movements = [
      fakeMovement(item.id, 4, { reason: "initial", createdAt: "2026-09-01T12:00:00.000Z" }),
      fakeMovement(item.id, -1, { createdAt: "2026-09-01T12:00:00.000Z" }),
      fakeMovement(item.id, -1, { createdAt: "2026-09-11T12:00:00.000Z" }),
    ];
    const [row] = buildStockRows({ items: [item], movements }, TODAY, 3);
    expect(row?.average).toBe(10);
    expect(row?.qty).toBe(2);
    expect(row?.note).toBe("Dura ~3 semanas");
  });
});

describe("buildFilters", () => {
  const cafe = fakeItem({ name: "Café", categoryId: despensa.id, locationId: armario.id });
  const arroz = fakeItem({ name: "Arroz", categoryId: despensa.id, locationId: banheiroLoc.id });
  const sabao = fakeItem({ name: "Sabão", categoryId: banheiroCat.id, locationId: null });
  const rows = rowsOf([cafe, 1], [arroz, 2], [sabao, 1]);

  it("Todos, categorias e locais com itens, cada grupo em ordem alfabetica", () => {
    const filters = buildFilters(rows, places, "all");
    expect(filters.map((f) => [f.key, f.label, f.count])).toEqual([
      ["all", "Todos", 3],
      ["cat:cat-banheiro", "Banheiro", 1],
      ["cat:cat-despensa", "Despensa", 2],
      ["loc:loc-armario", "Armário", 1],
      ["loc:loc-banheiro", "Banheiro", 1],
    ]);
  });

  it("o filtro ativo fica visivel mesmo com 0", () => {
    const filters = buildFilters(rows, places, "loc:loc-freezer");
    expect(filters.find((f) => f.key === "loc:loc-freezer")?.count).toBe(0);
    expect(filters.find((f) => f.key === "cat:cat-limpeza")).toBeUndefined();
  });

  it("categoria e local apagados nao aparecem", () => {
    const filters = buildFilters(
      rows,
      {
        categories: [place("cat-despensa", "Despensa", "x")],
        locations: [],
      },
      "all",
    );
    expect(filters.map((f) => f.key)).toEqual(["all"]);
  });
});

describe("validFilter", () => {
  it("chave de linha apagada ou desconhecida volta a all", () => {
    const data = { categories: [place("c1", "A", "x")], locations: [place("l1", "B")] };
    expect(validFilter("cat:c1", data)).toBe("all");
    expect(validFilter("cat:nada", data)).toBe("all");
    expect(validFilter("loc:l1", data)).toBe("loc:l1");
    expect(validFilter("cat:l1", data)).toBe("all");
    expect(validFilter("all", data)).toBe("all");
  });
});

describe("visibleRows", () => {
  const cafe = fakeItem({
    name: "Café em grãos",
    size: "Torrado 1 kg",
    categoryId: despensa.id,
    locationId: armario.id,
    ean: "7891234567890",
  });
  const arroz = fakeItem({
    name: "Arroz agulhinha",
    size: "5 kg",
    categoryId: despensa.id,
    locationId: null,
    ean: null,
  });
  const rows: StockRow[] = rowsOf([cafe, 1], [arroz, 2]);
  const names = (list: StockRow[]) => list.map((r) => r.item.name);

  it("busca sem acento e sem caixa no nome", () => {
    expect(names(visibleRows(rows, "all", "cafe"))).toEqual(["Café em grãos"]);
    expect(names(visibleRows(rows, "all", "ARROZ"))).toEqual(["Arroz agulhinha"]);
    expect(names(visibleRows(rows, "all", "  "))).toHaveLength(2);
  });

  it("busca pelo tamanho", () => {
    expect(names(visibleRows(rows, "all", "1 kg"))).toEqual(["Café em grãos"]);
  });

  it("so digitos procura tambem o EAN", () => {
    expect(names(visibleRows(rows, "all", "7891"))).toEqual(["Café em grãos"]);
    expect(visibleRows(rows, "all", "78a")).toEqual([]);
  });

  it("busca e filtro combinam", () => {
    expect(names(visibleRows(rows, "loc:loc-armario", ""))).toEqual(["Café em grãos"]);
    expect(names(visibleRows(rows, "cat:cat-despensa", "arroz"))).toEqual(["Arroz agulhinha"]);
    expect(visibleRows(rows, "loc:loc-armario", "arroz")).toEqual([]);
  });
});
