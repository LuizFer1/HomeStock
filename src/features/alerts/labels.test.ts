import { describe, expect, it } from "vitest";
import type { Location } from "../../domain/model/item";
import type { Member } from "../../domain/model/member";
import { fakeItem, fakeMovement } from "../../domain/model/row.fake";
import type {
  ActivityAlert,
  ActivityEntry,
  ExpiryAlert,
  StockAlert,
} from "../../domain/projections/alerts";
import {
  alertAction,
  alertMeta,
  alertTitle,
  bellLabel,
  clockOf,
  dayMonthOf,
  GROUP_LABEL,
  pendingLabel,
  whoName,
} from "./labels";

const iso = (d: number, h = 12, min = 0, month = 9) =>
  new Date(2026, month, d, h, min).toISOString();

const RAFA = { id: "RAFA", name: "Rafa", deletedAt: null } as unknown as Member;
const ANA = "ANA";
const TODAY = "2026-10-06";

function stock(overrides: Partial<StockAlert> = {}): StockAlert {
  const item = overrides.item ?? fakeItem({ name: "Sabão em pó", unit: "pct", min: 2 });
  return {
    kind: "out",
    key: "out:x:y",
    resolveKeys: ["out:x:y"],
    group: "today",
    resolved: false,
    item,
    qty: 0,
    since: iso(6, 8, 12),
    sinceMovement: null,
    onList: false,
    average: null,
    ...overrides,
  };
}

function expiry(daysLeft: number, overrides: Partial<ExpiryAlert> = {}): ExpiryAlert {
  return {
    kind: "exp",
    key: "exp:x:y",
    resolveKeys: ["exp:x:y"],
    group: "today",
    resolved: false,
    item: fakeItem({ name: "Iogurte natural", unit: "un", locationId: null }),
    qty: 2,
    daysLeft,
    ...overrides,
  };
}

function entry(name: string, overrides: Partial<ActivityEntry> = {}): ActivityEntry {
  return { id: name, name, unit: "pct", qty: 2, itemAlive: true, ...overrides };
}

function act(
  activity: ActivityAlert["activity"],
  entries: ActivityEntry[],
  overrides: Partial<ActivityAlert> = {},
): ActivityAlert {
  return {
    kind: "activity",
    key: `activity:${activity}:RAFA:2026-10-06`,
    resolveKeys: ["act:1"],
    group: "today",
    resolved: false,
    activity,
    actorId: "RAFA",
    day: "2026-10-06",
    at: iso(6, 8, 12),
    entries,
    ...overrides,
  };
}

const ctx = (locations: Location[] = []) => ({
  members: [RAFA],
  locations,
  localId: ANA,
  today: TODAY,
});

describe("rotulos simples", () => {
  it("pendentes", () => {
    expect(pendingLabel(0)).toBe("Nada pendente");
    expect(pendingLabel(1)).toBe("1 pendente");
    expect(pendingLabel(3)).toBe("3 pendentes");
    expect(bellLabel(0)).toBe("Alertas");
    expect(bellLabel(2)).toBe("Alertas, 2 pendentes");
  });

  it("grupos", () => {
    expect(GROUP_LABEL).toEqual({ today: "Hoje", week: "Esta semana", older: "Antes" });
  });

  it("hora e dia locais", () => {
    expect(clockOf(iso(6, 8, 12))).toBe("8:12");
    expect(clockOf(iso(6, 19, 5))).toBe("19:05");
    expect(dayMonthOf(iso(3))).toBe("03/10");
  });

  it("whoName", () => {
    expect(whoName(ANA, [RAFA], ANA)).toBe("Você");
    expect(whoName("RAFA", [RAFA], ANA)).toBe("Rafa");
    expect(whoName("ZZZ", [RAFA], ANA)).toBe("Outro morador");
    expect(whoName(null, [RAFA], ANA)).toBe("Outro morador");
  });
});

describe("alertTitle", () => {
  it("estoque", () => {
    expect(alertTitle(stock(), [RAFA])).toBe("Sabão em pó esgotou");
    expect(
      alertTitle(stock({ kind: "low", item: fakeItem({ name: "Café em grãos" }) }), [RAFA]),
    ).toBe("Café em grãos abaixo do mínimo");
  });

  it("validade", () => {
    expect(alertTitle(expiry(1), [RAFA])).toBe("Iogurte natural vence amanhã");
    expect(alertTitle(expiry(0), [RAFA])).toBe("Iogurte natural vence hoje");
    expect(alertTitle(expiry(-2), [RAFA])).toBe("Iogurte natural venceu");
    expect(alertTitle(expiry(3), [RAFA])).toBe("Iogurte natural vence em 3 dias");
  });

  it("atividade", () => {
    const cafe = entry("Café em grãos");
    const title = (a: ActivityAlert) => alertTitle(a, [RAFA]);
    expect(title(act("use", [cafe]))).toBe("Rafa usou 2 pct de Café em grãos");
    expect(title(act("use", [cafe, entry("Leite"), entry("Pão")]))).toBe("Rafa usou 3 itens");
    expect(title(act("restock", [entry("Café em grãos", { qty: 3 })]))).toBe(
      "Rafa guardou 3 pct de Café em grãos",
    );
    expect(title(act("restock", [cafe, entry("Leite")]))).toBe("Rafa guardou 2 itens");
    expect(title(act("request", [entry("Banana prata", { unit: "", qty: 1 })]))).toBe(
      "Rafa adicionou 1 item à lista",
    );
    expect(title(act("request", [entry("A"), entry("B")]))).toBe("Rafa adicionou 2 itens à lista");
  });

  it("ator sem linha vira Outro morador", () => {
    expect(alertTitle(act("use", [entry("Café")], { actorId: "ZZZ" }), [RAFA])).toBe(
      "Outro morador usou 2 pct de Café",
    );
  });
});

describe("alertMeta", () => {
  const anchor = (at: string) => fakeMovement("I", -1, { authorId: "RAFA", createdAt: at });

  it("out com ancora de hoje e na lista", () => {
    const a = stock({ sinceMovement: anchor(iso(6, 8, 12)), onList: true });
    expect(alertMeta(a, ctx())).toBe("Rafa registrou às 8:12 · já está na lista");
  });

  it("out de ontem e de 3/10", () => {
    expect(alertMeta(stock({ sinceMovement: anchor(iso(5, 19, 40)) }), ctx())).toBe(
      "Rafa registrou ontem",
    );
    expect(alertMeta(stock({ sinceMovement: anchor(iso(3)) }), ctx())).toBe(
      "Rafa registrou em 03/10",
    );
  });

  it("out sem ancora e fora da lista fica vazio", () => {
    expect(alertMeta(stock(), ctx())).toBe("");
  });

  it("low com media", () => {
    const a = stock({ kind: "low", qty: 1, average: 5 });
    expect(alertMeta(a, ctx())).toBe("1 de 2 pct · acaba em ~5 dias");
  });

  it("low sem media e na lista", () => {
    const a = stock({ kind: "low", qty: 1, onList: true });
    expect(alertMeta(a, ctx())).toBe("1 de 2 pct · já está na lista");
  });

  it("atividade: nomes e momento", () => {
    const meta = (a: ActivityAlert) => alertMeta(a, ctx());
    const request = act("request", [entry("Banana prata")], {
      day: "2026-10-05",
      at: iso(5, 19, 40),
    });
    expect(meta(request)).toBe("Banana prata · ontem, 19:40");
    expect(meta(act("use", [entry("Café em grãos"), entry("Leite integral")]))).toBe(
      "Café em grãos e Leite integral · hoje, 8:12",
    );
    const old = { day: "2026-10-03", at: iso(3, 9, 5) };
    expect(meta(act("use", [entry("A"), entry("B"), entry("C")], old))).toBe(
      "A, B e C · 03/10, 9:05",
    );
    expect(meta(act("use", [entry("A"), entry("B"), entry("C"), entry("D")], old))).toBe(
      "A, B e mais 2 · 03/10, 9:05",
    );
  });

  it("exp com local vivo e apagado", () => {
    const geladeira = {
      id: "L1",
      name: "Geladeira",
      deletedAt: null,
    } as unknown as Location;
    const apagada = { ...geladeira, deletedAt: "x" } as Location;
    const a = expiry(1, { item: fakeItem({ unit: "un", locationId: "L1" }) });
    expect(alertMeta(a, ctx([geladeira]))).toBe("2 un · Geladeira");
    expect(alertMeta(a, ctx([apagada]))).toBe("2 un");
  });
});

describe("alertAction", () => {
  it("os tres casos", () => {
    expect(alertAction(expiry(1))).toEqual({ kind: "use", label: "Marcar como usado" });
    expect(alertAction(stock())).toEqual({ kind: "list", label: "Adicionar à lista" });
    expect(alertAction(stock({ onList: true }))).toEqual({ kind: "view", label: "Ver item" });
  });

  it("atividade: Ver item so com um item vivo", () => {
    const view = { kind: "view", label: "Ver item" };
    const ack = { kind: "ack", label: "Entendi" };
    expect(alertAction(act("use", [entry("A")]))).toEqual(view);
    expect(alertAction(act("restock", [entry("A")]))).toEqual(view);
    expect(alertAction(act("use", [entry("A", { itemAlive: false })]))).toEqual(ack);
    expect(alertAction(act("use", [entry("A"), entry("B")]))).toEqual(ack);
    expect(alertAction(act("request", [entry("A", { itemAlive: true })]))).toEqual(ack);
  });
});
