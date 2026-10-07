import { describe, expect, it } from "vitest";
import type { Category, Location } from "../../domain/model/item";
import { fakeItem, fakeMovement, fakePrice } from "../../domain/model/row.fake";
import { buildStockCsv, CSV_HEADER, csvField, stockCsvFilename } from "./stock-csv";

const CAT = { id: "C1", name: "Despensa", deletedAt: null } as Category;
const LOC = { id: "L1", name: "Armário", deletedAt: null } as Location;

type Input = Parameters<typeof buildStockCsv>[0];

function build(parts: Partial<Input> = {}): string {
  return buildStockCsv({
    items: [],
    categories: [CAT],
    locations: [LOC],
    movements: [],
    prices: [],
    ...parts,
  });
}

/** Linhas de dados (sem cabecalho nem a vazia final). */
function rows(parts: Partial<Input> = {}): string[] {
  return build(parts).split("\r\n").slice(1, -1);
}

describe("buildStockCsv", () => {
  it("comeca com BOM e cabecalho e termina em CRLF", () => {
    const text = build();
    expect(text.startsWith("﻿")).toBe(true);
    expect(text).toBe(`﻿${CSV_HEADER.join(";")}\r\n`);
    expect(CSV_HEADER.join(";")).toBe(
      "Nome;Tamanho;Unidade;Quantidade;Mínimo;Categoria;Local;Validade;EAN;Último preço (R$)",
    );
  });

  it("soma entradas e usos e nunca sai negativo", () => {
    const a = fakeItem({ name: "A", categoryId: "C1" });
    const b = fakeItem({ name: "B", categoryId: "C1" });
    const lines = rows({
      items: [a, b],
      movements: [
        fakeMovement(a.id, 1),
        fakeMovement(a.id, 1),
        fakeMovement(a.id, 1),
        fakeMovement(a.id, -1),
        fakeMovement(b.id, -2),
      ],
    });
    expect(lines[0]?.split(";")[3]).toBe("2");
    expect(lines[1]?.split(";")[3]).toBe("0");
  });

  it("pula item apagado e ordena pelo nome", () => {
    const lines = rows({
      items: [
        fakeItem({ name: "Zebra" }),
        fakeItem({ name: "Arroz" }),
        fakeItem({ name: "Fantasma", deletedAt: "2026-10-02T00:00:00.000Z" }),
      ],
    });
    expect(lines.map((l) => l.split(";")[0])).toEqual(["Arroz", "Zebra"]);
  });

  it("categoria apagada vira Sem categoria e local nulo sai vazio", () => {
    const gone = { ...CAT, id: "C2", deletedAt: "2026-10-02T00:00:00.000Z" } as Category;
    const lines = rows({
      categories: [CAT, gone],
      items: [fakeItem({ name: "A", categoryId: "C2", locationId: null })],
    });
    const cols = lines[0]?.split(";");
    expect(cols?.[5]).toBe("Sem categoria");
    expect(cols?.[6]).toBe("");
  });

  it("local vivo, validade e EAN saem como estao", () => {
    const lines = rows({
      items: [
        fakeItem({
          name: "A",
          categoryId: "C1",
          locationId: "L1",
          expiresAt: "2026-12-01",
          ean: "789",
        }),
      ],
    });
    expect(lines[0]?.split(";").slice(5, 9)).toEqual(["Despensa", "Armário", "2026-12-01", "789"]);
  });

  it("formata o ultimo preco em reais com virgula", () => {
    const a = fakeItem({ name: "A" });
    const b = fakeItem({ name: "B" });
    const c = fakeItem({ name: "C" });
    const lines = rows({
      items: [a, b, c],
      prices: [fakePrice(a.id, 4290, "2026-10-01"), fakePrice(b.id, 5, "2026-10-01")],
    });
    expect(lines[0]?.split(";")[9]).toBe("42,90");
    expect(lines[1]?.split(";")[9]).toBe("0,05");
    expect(lines[2]?.split(";")[9]).toBe("");
  });

  it("protege separador, aspas e quebra de linha", () => {
    const text = build({
      items: [
        fakeItem({ name: "Arroz; tipo 1" }),
        fakeItem({ name: 'Leite "integral"' }),
        fakeItem({ name: "Linha\nnova" }),
      ],
    });
    expect(text).toContain('"Arroz; tipo 1";');
    expect(text).toContain('"Leite ""integral""";');
    expect(text).toContain('"Linha\nnova";');
  });
});

describe("csvField", () => {
  it("prefixa aspa simples contra injecao de formula", () => {
    expect(csvField("=SOMA(A1)")).toBe("'=SOMA(A1)");
    expect(csvField("-1")).toBe("'-1");
    expect(csvField("+1")).toBe("'+1");
    expect(csvField("@x")).toBe("'@x");
    expect(csvField("a-b")).toBe("a-b");
  });
});

describe("stockCsvFilename", () => {
  it("leva a data", () => {
    expect(stockCsvFilename("2026-10-06")).toBe("homestock-estoque-2026-10-06.csv");
  });
});
