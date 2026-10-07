import { describe, expect, it } from "vitest";
import { fakeItem, fakeMovement, fakePrice } from "../model/row.fake";
import { homeSummary } from "./home";

const TODAY = "2026-10-06";

function summary(
  items: ReturnType<typeof fakeItem>[],
  movements: ReturnType<typeof fakeMovement>[],
  prices: ReturnType<typeof fakePrice>[] = [],
  expDays = 3,
) {
  return homeSummary({ items, movements, prices, today: TODAY, expDays });
}

describe("homeSummary", () => {
  it("sem itens", () => {
    expect(summary([], [])).toEqual({
      items: 0,
      ok: 0,
      health: null,
      valueMinor: 0,
      runningOut: 0,
      expiring: 0,
    });
  });

  function house() {
    const cafe = fakeItem({ name: "Café", min: 2 });
    const sabao = fakeItem({ name: "Sabão", min: 1 });
    const iogurte = fakeItem({ name: "Iogurte", min: 0, expiresAt: "2026-10-07" });
    const arroz = fakeItem({ name: "Arroz", min: 1 });
    const movements = [
      fakeMovement(cafe.id, 1),
      fakeMovement(iogurte.id, 2),
      fakeMovement(arroz.id, 2),
    ];
    const prices = [
      fakePrice(cafe.id, 4290, "2026-10-01"),
      fakePrice(arroz.id, 2500, "2026-10-01"),
    ];
    return { cafe, sabao, iogurte, arroz, movements, prices };
  }

  it("conta itens, em dia, saude, valor, acabando e vencendo", () => {
    const h = house();
    const s = summary([h.cafe, h.sabao, h.iogurte, h.arroz], h.movements, h.prices);
    expect(s).toEqual({
      items: 4,
      ok: 1,
      health: 0.25,
      valueMinor: 4290 + 5000,
      runningOut: 2,
      expiring: 1,
    });
  });

  it("iogurte zerado nao conta como vencendo e entra em acabando", () => {
    const h = house();
    const none = h.movements.filter((m) => m.itemId !== h.iogurte.id);
    const s = summary([h.cafe, h.sabao, h.iogurte, h.arroz], none, h.prices);
    expect(s.expiring).toBe(0);
    expect(s.runningOut).toBe(3);
  });

  it("item apagado nao conta", () => {
    const h = house();
    const gone = { ...h.sabao, deletedAt: "2026-10-05T00:00:00.000Z" };
    const s = summary([h.cafe, gone, h.iogurte, h.arroz], h.movements, h.prices);
    expect(s.items).toBe(3);
    expect(s.runningOut).toBe(1);
  });

  it("expDays muda o vencendo", () => {
    const h = house();
    const items = [h.iogurte];
    expect(summary(items, h.movements, [], 0).expiring).toBe(0);
    expect(summary(items, h.movements, [], 1).expiring).toBe(1);
  });
});
