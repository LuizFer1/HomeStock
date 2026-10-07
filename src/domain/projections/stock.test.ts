import { describe, expect, it } from "vitest";
import { fakeItem, fakeMovement } from "../model/row.fake";
import { autoList, daysBetween, health, quantityOf, statusOf } from "./stock";

const TODAY = "2026-10-06";

describe("daysBetween", () => {
  it("conta dias de calendario", () => {
    expect(daysBetween("2026-10-06", "2026-10-09")).toBe(3);
    expect(daysBetween("2026-10-06", "2026-10-05")).toBe(-1);
    expect(daysBetween("2026-02-28", "2026-03-01")).toBe(1);
  });
});

describe("quantityOf", () => {
  it("soma os movimentos vivos do item", () => {
    const ms = [fakeMovement("A", 5), fakeMovement("A", -1), fakeMovement("B", 9)];
    expect(quantityOf("A", ms)).toBe(4);
  });

  it("ignora movimento desfeito", () => {
    const ms = [fakeMovement("A", 5), fakeMovement("A", -2, { deletedAt: "x" })];
    expect(quantityOf("A", ms)).toBe(5);
  });

  it("pode ficar negativa depois de um sync", () => {
    const ms = [fakeMovement("A", 1), fakeMovement("A", -1), fakeMovement("A", -1)];
    expect(quantityOf("A", ms)).toBe(-1);
  });

  it("item sem movimento tem zero", () => {
    expect(quantityOf("A", [])).toBe(0);
  });
});

describe("statusOf", () => {
  it.each([
    { qty: 0, min: 2, expiresAt: null, primary: "out" },
    { qty: -1, min: 2, expiresAt: null, primary: "out" },
    { qty: 1, min: 2, expiresAt: null, primary: "low" },
    { qty: 2, min: 2, expiresAt: null, primary: "ok" },
    { qty: 1, min: 0, expiresAt: null, primary: "ok" },
    { qty: 5, min: 2, expiresAt: "2026-10-09", primary: "exp" },
    { qty: 5, min: 2, expiresAt: "2026-10-10", primary: "ok" },
    { qty: 5, min: 2, expiresAt: "2026-10-01", primary: "exp" },
    { qty: 1, min: 2, expiresAt: "2026-10-07", primary: "low" },
  ] as const)(
    "qty $qty, min $min, vence $expiresAt -> $primary",
    ({ qty, min, expiresAt, primary }) => {
      expect(statusOf(fakeItem({ min, expiresAt }), qty, TODAY).primary).toBe(primary);
    },
  );

  it("baixo e vencendo ao mesmo tempo marca os dois", () => {
    const s = statusOf(fakeItem({ min: 2, expiresAt: TODAY }), 1, TODAY);
    expect(s).toMatchObject({ low: true, expiring: true, out: false });
  });
});

describe("autoList", () => {
  it("entra abaixo do minimo com a quantidade usual", () => {
    const item = fakeItem({ min: 2, usualQty: 3 });
    const list = autoList([item], [fakeMovement(item.id, 1)]);
    expect(list).toEqual([{ item, qty: 1, suggestion: 3 }]);
  });

  it("sai ao voltar ao minimo", () => {
    const item = fakeItem({ min: 2 });
    expect(autoList([item], [fakeMovement(item.id, 2)])).toEqual([]);
  });

  it("min zero nunca entra", () => {
    expect(autoList([fakeItem({ min: 0 })], [])).toEqual([]);
  });

  it("item apagado nao entra", () => {
    expect(autoList([fakeItem({ deletedAt: "x" })], [])).toEqual([]);
  });
});

describe("health", () => {
  it("fracao de itens em dia", () => {
    const ok = statusOf(fakeItem({ min: 1 }), 5, TODAY);
    const low = statusOf(fakeItem({ min: 3 }), 1, TODAY);
    expect(health([ok, ok, ok, low])).toBe(0.75);
  });

  it("null sem itens", () => {
    expect(health([])).toBeNull();
  });
});
