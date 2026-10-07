import { describe, expect, it } from "vitest";
import { fakeMovement } from "../model/row.fake";
import { consumptionOf, runsOutIn } from "./consumption";

function use(day: number, units = 1, overrides = {}) {
  const date = `2026-09-${String(day).padStart(2, "0")}T12:00:00.000Z`;
  return fakeMovement("A", -units, { createdAt: date, reason: "use", ...overrides });
}

describe("consumptionOf", () => {
  it("cada unidade dura ate o consumo seguinte", () => {
    const c = consumptionOf("A", [use(1), use(9), use(17)]);
    expect(c.daysPerUnit).toEqual([8, 8]);
    expect(c.average).toBe(8);
  });

  it("consumo de 2 unidades divide o intervalo", () => {
    const c = consumptionOf("A", [use(1, 2), use(11)]);
    expect(c.daysPerUnit).toEqual([5]);
    expect(c.average).toBe(5);
  });

  it("ordena por data, nao pela ordem recebida", () => {
    expect(consumptionOf("A", [use(17), use(1), use(9)]).daysPerUnit).toEqual([8, 8]);
  });

  it("menos de 2 consumos: sem media", () => {
    expect(consumptionOf("A", [use(1)])).toEqual({ daysPerUnit: [], average: null });
  });

  it("ignora reposicao, ajuste, outro item e desfeito", () => {
    const ms = [
      use(1),
      fakeMovement("A", 3, { createdAt: "2026-09-03T12:00:00.000Z" }),
      fakeMovement("A", -1, { createdAt: "2026-09-04T12:00:00.000Z", reason: "adjust" }),
      fakeMovement("B", -1, { createdAt: "2026-09-05T12:00:00.000Z", reason: "use" }),
      use(6, 1, { deletedAt: "x" }),
      use(11),
    ];
    expect(consumptionOf("A", ms).daysPerUnit).toEqual([10]);
  });

  it("mostra so os ultimos 8 intervalos", () => {
    const ms = Array.from({ length: 11 }, (_, i) => use(i + 1));
    expect(consumptionOf("A", ms).daysPerUnit).toHaveLength(8);
  });
});

describe("runsOutIn", () => {
  it("quantidade vezes a media", () => {
    expect(runsOutIn(2, 2.6)).toBe(5);
  });

  it("sem media nao estima", () => {
    expect(runsOutIn(2, null)).toBeNull();
  });

  it("ja acabou", () => {
    expect(runsOutIn(0, 8)).toBe(0);
    expect(runsOutIn(-1, 8)).toBe(0);
  });
});
