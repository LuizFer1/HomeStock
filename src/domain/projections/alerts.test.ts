import { describe, expect, it } from "vitest";
import { type AlertState, alertStateId } from "../model/alert-state";
import type { ListMark } from "../model/list-mark";
import { fakeItem, fakeMovement } from "../model/row.fake";
import { type AlertInput, alertsOf, stockEpisode } from "./alerts";

const TODAY = "2026-10-06";
const PREFS: AlertInput["prefs"] = {
  alertLow: true,
  alertExpiring: true,
  expiringDays: 3,
  alertActivity: true,
  autoList: true,
};

function input(overrides: Partial<AlertInput> = {}): AlertInput {
  return {
    items: [],
    movements: [],
    listMarks: [],
    listExtras: [],
    alertStates: [],
    prefs: PREFS,
    localMemberId: null,
    today: TODAY,
    dayOf: (iso) => iso.slice(0, 10),
    ...overrides,
  };
}

function alertState(key: string, deleted = false): AlertState {
  return {
    id: alertStateId(key),
    key,
    createdAt: "2026-10-06T10:00:00.000Z",
    updatedAt: "0000000000001-0000-00000000000000000000000000",
    deletedAt: deleted ? "2026-10-06T11:00:00.000Z" : null,
    dirty: 0,
    authorId: null,
  };
}

describe("stockEpisode", () => {
  it("a ancora low e o movimento que cruza abaixo do minimo", () => {
    const item = fakeItem({ min: 2 });
    const a = fakeMovement(item.id, 3);
    const b = fakeMovement(item.id, -1);
    const c = fakeMovement(item.id, -1);
    const ep = stockEpisode(item, [a, b, c]);
    expect(ep.qty).toBe(1);
    expect(ep.low).toBe(c);
    expect(ep.out).toBeNull();
  });

  it("repor e cruzar de novo muda a ancora", () => {
    const item = fakeItem({ min: 2 });
    const a = fakeMovement(item.id, 3);
    const b = fakeMovement(item.id, -1);
    const c = fakeMovement(item.id, -1);
    const d = fakeMovement(item.id, 3);
    const e = fakeMovement(item.id, -3);
    const ep = stockEpisode(item, [a, b, c, d, e]);
    expect(ep.qty).toBe(1);
    expect(ep.low).toBe(e);
  });

  it("nunca esteve acima: sem ancora", () => {
    const item = fakeItem({ min: 2 });
    const ep = stockEpisode(item, [fakeMovement(item.id, 1)]);
    expect(ep.low).toBeNull();
  });

  it("esgotar cruza out e low no mesmo movimento", () => {
    const item = fakeItem({ min: 2 });
    const a = fakeMovement(item.id, 2);
    const b = fakeMovement(item.id, -2);
    const ep = stockEpisode(item, [a, b]);
    expect(ep.out).toBe(b);
    expect(ep.low).toBe(b);
  });

  it("movimento apagado nao conta", () => {
    const item = fakeItem({ min: 2 });
    const a = fakeMovement(item.id, 3);
    const b = fakeMovement(item.id, -2, { deletedAt: "2026-10-06T00:00:00.000Z" });
    const ep = stockEpisode(item, [a, b]);
    expect(ep.qty).toBe(3);
    expect(ep.low).toBeNull();
  });

  it("ignora movimento de outro item", () => {
    const item = fakeItem({ min: 2 });
    const other = fakeItem();
    const ep = stockEpisode(item, [fakeMovement(item.id, 3), fakeMovement(other.id, -3)]);
    expect(ep.qty).toBe(3);
  });

  it("segue o updatedAt (HLC), nao o createdAt", () => {
    const item = fakeItem({ min: 2 });
    const a = fakeMovement(item.id, 3, { createdAt: "2026-10-05T00:00:00.000Z" });
    const b = fakeMovement(item.id, -2, { createdAt: "2026-10-01T00:00:00.000Z" });
    const ep = stockEpisode(item, [b, a]);
    expect(ep.low).toBe(b);
  });
});

describe("alertsOf: estoque", () => {
  function cafe(createdAt = "2026-10-06T08:00:00.000Z", qtyLeft = 1) {
    const item = fakeItem({ min: 2 });
    const movements = [fakeMovement(item.id, 3)];
    const used: ReturnType<typeof fakeMovement>[] = [];
    for (let i = 0; i < 3 - qtyLeft; i += 1) {
      used.push(fakeMovement(item.id, -1, { createdAt }));
    }
    return { item, movements: [...movements, ...used], used };
  }

  it("abaixo do minimo gera low com a chave do episodio", () => {
    const { item, movements, used } = cafe();
    const list = alertsOf(input({ items: [item], movements }));
    expect(list.total).toBe(1);
    expect(list.pending).toBe(1);
    const alert = list.today[0];
    expect(alert?.kind).toBe("low");
    const last = used[used.length - 1];
    expect(alert?.key).toBe(`low:${item.id}:${last?.id}`);
    expect(alert?.resolveKeys).toEqual([alert?.key]);
    if (alert?.kind === "low") expect(alert.onList).toBe(true);
  });

  it("o grupo vem do dia do movimento-ancora", () => {
    for (const [at, group] of [
      ["2026-10-06T08:00:00.000Z", "today"],
      ["2026-10-01T08:00:00.000Z", "week"],
      ["2026-09-20T08:00:00.000Z", "older"],
    ] as const) {
      const { item, movements } = cafe(at);
      const list = alertsOf(input({ items: [item], movements }));
      expect(list[group]).toHaveLength(1);
    }
  });

  it("zerado gera so out", () => {
    const { item, movements } = cafe("2026-10-06T08:00:00.000Z", 0);
    const list = alertsOf(input({ items: [item], movements }));
    expect(list.total).toBe(1);
    expect(list.today[0]?.kind).toBe("out");
  });

  it("min 0 nunca gera alerta de estoque", () => {
    const item = fakeItem({ min: 0 });
    const list = alertsOf(input({ items: [item], movements: [fakeMovement(item.id, -1)] }));
    expect(list.total).toBe(0);
  });

  it("item apagado nao gera", () => {
    const item = fakeItem({ min: 2, deletedAt: "2026-10-06T00:00:00.000Z" });
    expect(alertsOf(input({ items: [item] })).total).toBe(0);
  });

  it("alertLow desligado esconde", () => {
    const { item, movements } = cafe();
    const list = alertsOf(
      input({ items: [item], movements, prefs: { ...PREFS, alertLow: false } }),
    );
    expect(list.total).toBe(0);
  });

  it("onList falso sem lista automatica e sem marca", () => {
    const { item, movements } = cafe();
    const list = alertsOf(
      input({ items: [item], movements, prefs: { ...PREFS, autoList: false } }),
    );
    const alert = list.today[0];
    expect(alert?.kind === "low" && alert.onList).toBe(false);
  });

  it("onList verdadeiro com marca fixada viva", () => {
    const { item, movements } = cafe();
    const { key: _key, ...row } = alertState("x:y");
    const mark: ListMark = {
      ...row,
      // Mais nova que o restock: marca velha demais e ignorada pelo liveMarkOf.
      updatedAt: `9999999999999-0000-${"0".repeat(26)}`,
      itemId: item.id,
      pinned: 1,
      checked: 0,
      qty: null,
      priceMinor: null,
      pinnedBy: null,
    };
    const list = alertsOf(
      input({
        items: [item],
        movements,
        prefs: { ...PREFS, autoList: false },
        listMarks: [mark],
      }),
    );
    const alert = list.today[0];
    expect(alert?.kind === "low" && alert.onList).toBe(true);
  });
});

describe("alertsOf: validade", () => {
  function iogurte(expiresAt: string | null, qty = 2) {
    const item = fakeItem({ name: "Iogurte", min: 0, expiresAt });
    return { item, movements: qty > 0 ? [fakeMovement(item.id, qty)] : [] };
  }

  it("vence amanha: exp em Hoje com a chave da data", () => {
    const { item, movements } = iogurte("2026-10-07");
    const list = alertsOf(input({ items: [item], movements }));
    const alert = list.today[0];
    expect(alert?.kind).toBe("exp");
    expect(alert?.key).toBe(`exp:${item.id}:2026-10-07`);
    if (alert?.kind === "exp") expect(alert.daysLeft).toBe(1);
  });

  it("em 3 dias cai em Esta semana", () => {
    const { item, movements } = iogurte("2026-10-09");
    expect(alertsOf(input({ items: [item], movements })).week).toHaveLength(1);
  });

  it("fora da janela some; com janela maior aparece", () => {
    const { item, movements } = iogurte("2026-10-10");
    expect(alertsOf(input({ items: [item], movements })).total).toBe(0);
    const wider = alertsOf(
      input({ items: [item], movements, prefs: { ...PREFS, expiringDays: 5 } }),
    );
    expect(wider.total).toBe(1);
  });

  it("sem unidade em casa nao alerta", () => {
    const { item, movements } = iogurte("2026-10-07", 0);
    expect(alertsOf(input({ items: [item], movements })).total).toBe(0);
  });

  it("vencido ha 5 dias fica em Esta semana; ha 16, em Antes", () => {
    const a = iogurte("2026-10-01");
    expect(alertsOf(input({ items: [a.item], movements: a.movements })).week).toHaveLength(1);
    const b = iogurte("2026-09-20");
    expect(alertsOf(input({ items: [b.item], movements: b.movements })).older).toHaveLength(1);
  });

  it("alertExpiring desligado esconde", () => {
    const { item, movements } = iogurte("2026-10-07");
    const list = alertsOf(
      input({ items: [item], movements, prefs: { ...PREFS, alertExpiring: false } }),
    );
    expect(list.total).toBe(0);
  });
});

describe("alertsOf: resolvido e ordem", () => {
  it("linha viva resolve; linha apagada nao", () => {
    const item = fakeItem({ name: "Iogurte", min: 0, expiresAt: "2026-10-07" });
    const movements = [fakeMovement(item.id, 2)];
    const key = `exp:${item.id}:2026-10-07`;
    const done = alertsOf(input({ items: [item], movements, alertStates: [alertState(key)] }));
    expect(done.today[0]?.resolved).toBe(true);
    expect(done.pending).toBe(0);
    expect(done.total).toBe(1);
    const reopened = alertsOf(
      input({ items: [item], movements, alertStates: [alertState(key, true)] }),
    );
    expect(reopened.today[0]?.resolved).toBe(false);
    expect(reopened.pending).toBe(1);
  });

  it("em Hoje: out, low, exp; low em ordem pt-BR", () => {
    const at = "2026-10-06T08:00:00.000Z";
    const sabao = fakeItem({ name: "Sabão", min: 1 });
    const cafe = fakeItem({ name: "Café", min: 2 });
    const agua = fakeItem({ name: "Água", min: 2 });
    const iogurte = fakeItem({ name: "Iogurte", min: 0, expiresAt: "2026-10-07" });
    const movements = [
      fakeMovement(iogurte.id, 1),
      fakeMovement(cafe.id, 3),
      fakeMovement(cafe.id, -2, { createdAt: at }),
      fakeMovement(agua.id, 3),
      fakeMovement(agua.id, -2, { createdAt: at }),
      fakeMovement(sabao.id, 1),
      fakeMovement(sabao.id, -1, { createdAt: at }),
    ];
    const list = alertsOf(input({ items: [iogurte, cafe, agua, sabao], movements }));
    expect(list.today.map((a) => `${a.kind}:${a.item.name}`)).toEqual([
      "out:Sabão",
      "low:Água",
      "low:Café",
      "exp:Iogurte",
    ]);
  });
});
