import { describe, expect, it } from "vitest";
import { fakeItem, fakeMovement, fakePrice } from "../model/row.fake";
import { lastPriceOf, stockValue } from "./value";

describe("lastPriceOf", () => {
  it("preco da compra mais recente", () => {
    const ps = [fakePrice("A", 4290, "2026-09-01"), fakePrice("A", 3990, "2026-08-01")];
    expect(lastPriceOf("A", ps)).toBe(4290);
  });

  it("mesmo dia: desempata pelo HLC", () => {
    const ps = [fakePrice("A", 100, "2026-09-01"), fakePrice("A", 200, "2026-09-01")];
    expect(lastPriceOf("A", ps)).toBe(200);
  });

  it("ignora desfeito e outro item", () => {
    const ps = [
      fakePrice("A", 100, "2026-08-01"),
      fakePrice("A", 999, "2026-09-01", { deletedAt: "x" }),
      fakePrice("B", 777, "2026-10-01"),
    ];
    expect(lastPriceOf("A", ps)).toBe(100);
  });

  it("null sem historico", () => {
    expect(lastPriceOf("A", [])).toBeNull();
  });
});

describe("stockValue", () => {
  it("soma quantidade vezes ultimo preco", () => {
    const cafe = fakeItem();
    const arroz = fakeItem();
    const ms = [fakeMovement(cafe.id, 2), fakeMovement(arroz.id, 3)];
    const ps = [fakePrice(cafe.id, 4290, "2026-09-01"), fakePrice(arroz.id, 1000, "2026-09-01")];
    expect(stockValue([cafe, arroz], ms, ps)).toBe(2 * 4290 + 3 * 1000);
  });

  it("item sem preco nao conta, negativo conta zero", () => {
    const semPreco = fakeItem();
    const negativo = fakeItem();
    const ms = [fakeMovement(semPreco.id, 5), fakeMovement(negativo.id, -1)];
    expect(stockValue([semPreco, negativo], ms, [fakePrice(negativo.id, 500, "2026-09-01")])).toBe(
      0,
    );
  });
});
