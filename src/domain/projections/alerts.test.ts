import { describe, expect, it } from "vitest";
import { type AlertState, alertStateId } from "../model/alert-state";
import type { ListExtra } from "../model/list-extra";
import type { ListMark } from "../model/list-mark";
import type { Movement } from "../model/movement";
import { fakeItem, fakeMovement } from "../model/row.fake";
import { type ActivityAlert, type AlertInput, alertsOf, stockEpisode } from "./alerts";

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

describe("alertsOf: bordas", () => {
  it("ancora start: chave low:<id>:start e since do cadastro", () => {
    const item = fakeItem({ min: 3, createdAt: "2026-10-04T09:00:00.000Z" });
    const list = alertsOf(input({ items: [item], movements: [fakeMovement(item.id, 1)] }));
    const alert = list.week[0];
    expect(alert?.key).toBe(`low:${item.id}:start`);
    if (alert?.kind === "low") {
      expect(alert.since).toBe(item.createdAt);
      expect(alert.sinceMovement).toBeNull();
    }
  });

  it("dois exp saem por dias restantes", () => {
    const later = fakeItem({ name: "A", min: 0, expiresAt: "2026-10-07" });
    const sooner = fakeItem({ name: "B", min: 0, expiresAt: "2026-10-06" });
    const movements = [fakeMovement(later.id, 1), fakeMovement(sooner.id, 1)];
    const list = alertsOf(input({ items: [later, sooner], movements }));
    expect(list.today.map((a) => (a.kind === "exp" ? a.item.name : ""))).toEqual(["B", "A"]);
  });

  it("alertLow desligado ainda deixa o exp do mesmo item", () => {
    const item = fakeItem({ min: 5, expiresAt: "2026-10-07" });
    const list = alertsOf(
      input({
        items: [item],
        movements: [fakeMovement(item.id, 1)],
        prefs: { ...PREFS, alertLow: false },
      }),
    );
    expect(list.today.map((a) => a.kind)).toEqual(["exp"]);
  });

  it("resolver o out tambem resolve o low da mesma ancora", () => {
    const item = fakeItem({ min: 2 });
    const up = fakeMovement(item.id, 2, { createdAt: "2026-10-01T12:00:00.000Z" });
    const down = fakeMovement(item.id, -2, { createdAt: "2026-10-06T08:00:00.000Z" });
    const base = [up, down];
    const out = alertsOf(input({ items: [item], movements: base })).today[0];
    expect(out?.kind).toBe("out");
    expect(out?.resolveKeys).toEqual([`out:${item.id}:${down.id}`, `low:${item.id}:${down.id}`]);
    const states = out?.resolveKeys.map((k) => alertState(k)) ?? [];
    const after = alertsOf(
      input({
        items: [item],
        movements: [...base, fakeMovement(item.id, 1, { createdAt: "2026-10-06T12:00:00.000Z" })],
        alertStates: states,
      }),
    );
    expect(after.total).toBe(1);
    expect(after.pending).toBe(0);
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
    expect(list.today.map((a) => `${a.kind}:${a.kind === "activity" ? "" : a.item.name}`)).toEqual([
      "out:Sabão",
      "low:Água",
      "low:Café",
      "exp:Iogurte",
    ]);
  });
});

describe("alertsOf: atividade da casa", () => {
  const ANA = "ANA";
  const RAFA = "RAFA";
  const at = (day: string, hour = 12) => `${day}T${String(hour).padStart(2, "0")}:00:00.000Z`;
  const flat = (list: ReturnType<typeof alertsOf>) => [...list.today, ...list.week, ...list.older];
  const activity = (list: ReturnType<typeof alertsOf>) =>
    flat(list).filter((a): a is ActivityAlert => a.kind === "activity");
  // Minimo 0: o estoque nunca alerta e so a atividade aparece.
  const cafe = () => fakeItem({ name: "Café em grãos", unit: "pct", min: 0 });
  const withLocal = (overrides: Partial<AlertInput>) => input({ localMemberId: ANA, ...overrides });

  let extraSeq = 0;
  function extra(overrides: Partial<ListExtra> = {}): ListExtra {
    extraSeq += 1;
    return {
      id: `X${String(extraSeq).padStart(25, "0")}`,
      createdAt: at("2026-10-05", 19),
      updatedAt: "0000000000002-0000-00000000000000000000000000",
      deletedAt: null,
      dirty: 0,
      authorId: null,
      name: "Banana prata",
      qty: null,
      priceMinor: null,
      checked: 0,
      requestedBy: RAFA,
      ...overrides,
    };
  }

  it("uso de outro morador hoje vira um cartao use", () => {
    const item = cafe();
    const m = fakeMovement(item.id, -2, { authorId: RAFA, createdAt: at("2026-10-06") });
    const list = alertsOf(withLocal({ items: [item], movements: [fakeMovement(item.id, 5), m] }));
    const [card] = activity(list);
    expect(list.today).toContain(card);
    expect(card).toMatchObject({
      kind: "activity",
      activity: "use",
      actorId: RAFA,
      day: "2026-10-06",
      key: "activity:use:RAFA:2026-10-06",
      resolveKeys: [`act:${m.id}`],
      group: "today",
      resolved: false,
      entries: [{ id: item.id, name: "Café em grãos", unit: "pct", qty: 2, itemAlive: true }],
    });
  });

  it("morador local, semente e sem morador local nao geram nada", () => {
    const item = cafe();
    const mine = fakeMovement(item.id, -1, { authorId: ANA, createdAt: at("2026-10-06") });
    const seed = fakeMovement(item.id, -1, { authorId: null, createdAt: at("2026-10-06") });
    const base = { items: [item], movements: [fakeMovement(item.id, 5), mine, seed] };
    expect(activity(alertsOf(withLocal(base)))).toEqual([]);
    const theirs = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06") });
    const noLocal = input({ items: [item], movements: [theirs] });
    expect(activity(alertsOf(noLocal))).toEqual([]);
  });

  it("usos do mesmo dia viram um cartao, entradas somadas, mais recente primeiro", () => {
    const cafeItem = cafe();
    const leite = fakeItem({ name: "Leite integral", unit: "cx", min: 0 });
    const c1 = fakeMovement(cafeItem.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 9) });
    const c2 = fakeMovement(cafeItem.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 10) });
    const l1 = fakeMovement(leite.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 11) });
    const movements = [fakeMovement(cafeItem.id, 5), fakeMovement(leite.id, 5), c1, c2, l1];
    const cards = activity(alertsOf(withLocal({ items: [cafeItem, leite], movements })));
    expect(cards).toHaveLength(1);
    const [card] = cards;
    expect(card?.resolveKeys).toEqual([`act:${l1.id}`, `act:${c2.id}`, `act:${c1.id}`]);
    expect(card?.at).toBe(at("2026-10-06", 11));
    expect(card?.entries.map((e) => `${e.name} ${e.qty}`)).toEqual([
      "Leite integral 1",
      "Café em grãos 2",
    ]);
  });

  it("guardar vira outro cartao; ontem fica em Esta semana", () => {
    const item = cafe();
    const r = fakeMovement(item.id, 3, { authorId: RAFA, createdAt: at("2026-10-05") });
    const list = alertsOf(withLocal({ items: [item], movements: [r] }));
    const [card] = activity(list);
    expect(card).toMatchObject({ activity: "restock", group: "week", day: "2026-10-05" });
    expect(card?.entries[0]?.qty).toBe(3);
    expect(list.week).toContain(card);
  });

  it("a janela e de 7 dias: 6 dias atras entra, 7 nao", () => {
    const item = cafe();
    const old = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-09-29") });
    const edge = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-09-30") });
    const list = alertsOf(withLocal({ items: [item], movements: [old, edge] }));
    expect(activity(list).map((a) => a.day)).toEqual(["2026-09-30"]);
  });

  it("movimento apagado, initial e adjust nao contam", () => {
    const item = cafe();
    const when = at("2026-10-06");
    const movements = [
      fakeMovement(item.id, -1, { authorId: RAFA, createdAt: when, deletedAt: when }),
      fakeMovement(item.id, 5, { authorId: RAFA, createdAt: when, reason: "initial" }),
      fakeMovement(item.id, -1, { authorId: RAFA, createdAt: when, reason: "adjust" }),
    ];
    expect(activity(alertsOf(withLocal({ items: [item], movements })))).toEqual([]);
  });

  it("pedido avulso de outro morador; linha antiga usa o authorId; apagado sai", () => {
    const novo = extra();
    const antigo = extra({ name: "Pão", requestedBy: undefined, authorId: RAFA });
    const apagado = extra({ name: "Ovo", deletedAt: at("2026-10-05", 20) });
    const meu = extra({ name: "Sal", requestedBy: ANA });
    const cards = activity(alertsOf(withLocal({ listExtras: [novo, antigo, apagado, meu] })));
    expect(cards).toHaveLength(1);
    const [card] = cards;
    expect(card).toMatchObject({ activity: "request", key: "activity:request:RAFA:2026-10-05" });
    expect(card?.entries.map((e) => e.name).sort()).toEqual(["Banana prata", "Pão"]);
    expect(card?.entries[0]).toMatchObject({ unit: "", qty: 1, itemAlive: false });
    expect(card?.resolveKeys).toHaveLength(2);
  });

  it("so resolve com todas as chaves; evento novo reabre", () => {
    const item = cafe();
    const m1 = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 9) });
    const m2 = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 10) });
    const run = (states: AlertState[], movements: Movement[]) =>
      activity(alertsOf(withLocal({ items: [item], movements, alertStates: states })));
    expect(run([alertState(`act:${m1.id}`)], [m1, m2])[0]?.resolved).toBe(false);
    const both = [alertState(`act:${m1.id}`), alertState(`act:${m2.id}`)];
    expect(run(both, [m1, m2])[0]?.resolved).toBe(true);
    const m3 = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 11) });
    expect(run(both, [m1, m2, m3])[0]?.resolved).toBe(false);
  });

  it("item apagado entra com itemAlive false", () => {
    const item = fakeItem({ name: "Velho", min: 0, deletedAt: at("2026-10-06") });
    const m = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06") });
    const list = alertsOf(withLocal({ items: [item], movements: [m] }));
    expect(activity(list)[0]?.entries[0]).toMatchObject({ name: "Velho", itemAlive: false });
  });

  it("movimento de item ausente da tabela e ignorado", () => {
    const m = fakeMovement("SEMITEM", -1, { authorId: RAFA, createdAt: at("2026-10-06") });
    expect(activity(alertsOf(withLocal({ movements: [m] })))).toEqual([]);
  });

  it("alertActivity desligado esconde so a atividade", () => {
    const item = fakeItem({ min: 2 });
    const movements = [
      fakeMovement(item.id, 1),
      fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06") }),
    ];
    const on = alertsOf(withLocal({ items: [item], movements }));
    expect(activity(on)).toHaveLength(1);
    const off = alertsOf(
      withLocal({ items: [item], movements, prefs: { ...PREFS, alertActivity: false } }),
    );
    expect(activity(off)).toEqual([]);
    expect(flat(off).map((a) => a.kind)).toEqual(["out"]);
  });

  it("ordena a atividade por at decrescente", () => {
    const item = fakeItem({ min: 0 });
    const early = extra({ createdAt: at("2026-10-06", 8) });
    const late = fakeMovement(item.id, -1, { authorId: RAFA, createdAt: at("2026-10-06", 15) });
    const list = alertsOf(withLocal({ items: [item], movements: [late], listExtras: [early] }));
    expect(list.today.map((a) => (a.kind === "activity" ? a.activity : a.kind))).toEqual([
      "use",
      "request",
    ]);
  });
});
