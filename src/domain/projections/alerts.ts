import { compareHlc } from "../clock/hlc";
import type { Ulid } from "../ids/ulid";
import { type AlertState, resolvedKeys } from "../model/alert-state";
import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import { type ListExtra, requesterOf } from "../model/list-extra";
import type { ListMark } from "../model/list-mark";
import type { Movement } from "../model/movement";
import type { PrefValues } from "../model/prefs";
import { consumptionOf } from "./consumption";
import { listStatusOf, liveMarksByItem } from "./shopping";
import { daysBetween } from "./stock";

export type AlertGroup = "today" | "week" | "older";
export type ActivityKind = "use" | "restock" | "request";

export interface AlertBase {
  /** Identidade na tela (data-alert-key, key do Preact). */
  key: string;
  /** Chaves gravadas em alertStates ao resolver. */
  resolveKeys: string[];
  group: AlertGroup;
  resolved: boolean;
}

export interface StockAlert extends AlertBase {
  kind: "out" | "low";
  item: Item;
  /** Soma dos movimentos (pode ser negativa; a tela mostra max 0). */
  qty: number;
  /** ISO do createdAt do movimento-ancora, ou do item com ancora "start". */
  since: string;
  /** Movimento-ancora; null com ancora "start". */
  sinceMovement: Movement | null;
  /** Na lista automatica (autoList ligado) ou fixado. */
  onList: boolean;
  /** Media de dias por unidade (consumptionOf); null sem historico. */
  average: number | null;
}

export interface ExpiryAlert extends AlertBase {
  kind: "exp";
  item: Item;
  qty: number;
  /** daysBetween(today, expiresAt); negativo = venceu. */
  daysLeft: number;
}

export interface ActivityEntry {
  /** itemId (use/restock) ou id do pedido (request). */
  id: Ulid;
  name: string;
  /** Unidade do item; "" no pedido. */
  unit: string;
  /** Unidades usadas ou guardadas no dia (positivo); qty ?? 1 no pedido. */
  qty: number;
  /** Item vivo (sempre false no pedido). */
  itemAlive: boolean;
}

export interface ActivityAlert extends AlertBase {
  kind: "activity";
  activity: ActivityKind;
  actorId: Ulid;
  /** 'YYYY-MM-DD' local dos eventos. */
  day: string;
  /** ISO do evento mais recente. */
  at: string;
  /** Mais recente primeiro; uma entrada por item (ou pedido). */
  entries: ActivityEntry[];
}

export type Alert = StockAlert | ExpiryAlert | ActivityAlert;

export interface AlertList {
  today: Alert[];
  week: Alert[];
  older: Alert[];
  /** Nao resolvidos, nos tres grupos. */
  pending: number;
  total: number;
}

export interface AlertInput {
  items: readonly Item[];
  movements: readonly Movement[];
  listMarks: readonly ListMark[];
  listExtras: readonly ListExtra[];
  alertStates: readonly AlertState[];
  prefs: Pick<
    PrefValues,
    "alertLow" | "alertExpiring" | "expiringDays" | "alertActivity" | "autoList"
  >;
  localMemberId: Ulid | null;
  today: string;
  /** Dia local 'YYYY-MM-DD' de um ISO. */
  dayOf: (iso: string) => string;
}

/**
 * Episodio de estoque do item: a soma e o movimento que a levou abaixo do minimo
 * (low) e a zero (out). Ordem por HLC, igual em todo aparelho: a chave do alerta
 * precisa ser a mesma nos dois celulares para o resolvido sincronizar.
 */
export function stockEpisode(
  item: Item,
  movements: readonly Movement[],
): { qty: number; low: Movement | null; out: Movement | null } {
  const own = movements
    .filter((m) => isAlive(m) && m.itemId === item.id)
    .sort(
      (a, b) => compareHlc(a.updatedAt, b.updatedAt) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
    );
  let sum = 0;
  let low: Movement | null = null;
  let out: Movement | null = null;
  for (const m of own) {
    const prev = sum;
    sum += m.delta;
    if (prev >= item.min && sum < item.min) low = m;
    if (prev > 0 && sum <= 0) out = m;
  }
  return { qty: sum, low, out };
}

const collator = new Intl.Collator("pt-BR");
const KIND_ORDER: Record<Alert["kind"], number> = { out: 0, low: 1, exp: 2, activity: 3 };

/** Janela da atividade da casa, em dias locais (hoje e os 6 anteriores). */
export const ACTIVITY_DAYS = 7;

function compareAlerts(a: Alert, b: Alert): number {
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  if (a.kind === "activity" && b.kind === "activity") {
    return a.at < b.at ? 1 : a.at > b.at ? -1 : a.key < b.key ? -1 : a.key > b.key ? 1 : 0;
  }
  // So estreita o tipo: out/low/exp tem `item` e atividade nunca chega aqui misturada
  // com eles (o KIND_ORDER ja os separou).
  if (a.kind === "activity" || b.kind === "activity") return 0;
  if (a.kind === "exp" && b.kind === "exp" && a.daysLeft !== b.daysLeft) {
    return a.daysLeft - b.daysLeft;
  }
  // A chave desempata nomes iguais: a ordem nao depende da ordem das tabelas.
  return collator.compare(a.item.name, b.item.name) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
}

function stockGroup(since: string, input: AlertInput): AlertGroup {
  const d = daysBetween(input.dayOf(since), input.today);
  return d <= 0 ? "today" : d <= 6 ? "week" : "older";
}

function expiryGroup(daysLeft: number): AlertGroup {
  if (daysLeft >= 0 && daysLeft <= 1) return "today";
  return daysLeft >= -6 ? "week" : "older";
}

interface ActivityEvent {
  /** Linha que originou o evento: vira `act:<id>` ao resolver. */
  id: Ulid;
  createdAt: string;
  activity: ActivityKind;
  actorId: Ulid;
  day: string;
  entry: ActivityEntry;
}

/** Mais recente primeiro; o id desempata para a ordem ser igual em todo aparelho. */
function newestFirst(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }) {
  if (a.createdAt !== b.createdAt) return a.createdAt < b.createdAt ? 1 : -1;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

/**
 * O que outro morador fez nos ultimos 7 dias, um cartao por (tipo, morador, dia).
 * Sem sync (fatia 7) toda linha e do morador local e a lista nasce vazia.
 * A resolucao e por evento (`act:<id>`): um evento novo reabre so o cartao do dia dele.
 */
export function activityAlerts(input: AlertInput, resolved: ReadonlySet<string>): ActivityAlert[] {
  const { localMemberId } = input;
  if (localMemberId === null) return [];

  const items = new Map<Ulid, Item>(input.items.map((item) => [item.id, item]));
  const events: ActivityEvent[] = [];
  const inWindow = (day: string) => {
    const d = daysBetween(day, input.today);
    return d >= 0 && d < ACTIVITY_DAYS;
  };

  for (const m of input.movements) {
    if (!isAlive(m) || (m.reason !== "use" && m.reason !== "restock")) continue;
    if (m.authorId === null || m.authorId === localMemberId) continue;
    const item = items.get(m.itemId);
    if (item === undefined) continue;
    const day = input.dayOf(m.createdAt);
    if (!inWindow(day)) continue;
    events.push({
      id: m.id,
      createdAt: m.createdAt,
      activity: m.reason,
      actorId: m.authorId,
      day,
      entry: {
        id: item.id,
        name: item.name,
        unit: item.unit,
        qty: m.reason === "use" ? -m.delta : m.delta,
        itemAlive: isAlive(item),
      },
    });
  }

  for (const extra of input.listExtras) {
    if (!isAlive(extra)) continue;
    const actorId = requesterOf(extra);
    if (actorId === null || actorId === localMemberId) continue;
    const day = input.dayOf(extra.createdAt);
    if (!inWindow(day)) continue;
    events.push({
      id: extra.id,
      createdAt: extra.createdAt,
      activity: "request",
      actorId,
      day,
      entry: { id: extra.id, name: extra.name, unit: "", qty: extra.qty ?? 1, itemAlive: false },
    });
  }

  // Do mais recente ao mais antigo: a primeira vez que um item aparece fixa a
  // posicao dele nas entradas e o primeiro evento do grupo fixa o `at`.
  events.sort(newestFirst);
  const cards = new Map<string, ActivityAlert>();
  for (const ev of events) {
    const key = `activity:${ev.activity}:${ev.actorId}:${ev.day}`;
    let card = cards.get(key);
    if (card === undefined) {
      card = {
        kind: "activity",
        key,
        resolveKeys: [],
        group: daysBetween(ev.day, input.today) === 0 ? "today" : "week",
        resolved: false,
        activity: ev.activity,
        actorId: ev.actorId,
        day: ev.day,
        at: ev.createdAt,
        entries: [],
      };
      cards.set(key, card);
    }
    card.resolveKeys.push(`act:${ev.id}`);
    const same = card.entries.find((e) => e.id === ev.entry.id);
    if (same === undefined) card.entries.push({ ...ev.entry });
    else same.qty += ev.entry.qty;
  }
  for (const card of cards.values()) card.resolved = card.resolveKeys.every((k) => resolved.has(k));
  return [...cards.values()];
}

/** Os alertas da casa: projecao pura. So o resolvido e gravado (alertStates). */
export function alertsOf(input: AlertInput): AlertList {
  const { prefs } = input;
  const byItem = new Map<Ulid, Movement[]>();
  for (const m of input.movements) {
    const list = byItem.get(m.itemId);
    if (list === undefined) byItem.set(m.itemId, [m]);
    else list.push(m);
  }
  const marks = liveMarksByItem(input.items, input.movements, input.listMarks);
  const done = resolvedKeys(input.alertStates);
  const isDone = (keys: readonly string[]) => keys.every((k) => done.has(k));

  const groups: Record<AlertGroup, Alert[]> = { today: [], week: [], older: [] };

  for (const item of input.items) {
    if (!isAlive(item)) continue;
    const own = byItem.get(item.id) ?? [];
    const ep = stockEpisode(item, own);

    if (prefs.alertLow && item.min > 0) {
      const kind = ep.qty <= 0 ? "out" : ep.qty < item.min ? "low" : null;
      if (kind !== null) {
        const anchor = kind === "out" ? ep.out : ep.low;
        // Nunca esteve acima desde o cadastro: o episodio comeca no proprio item.
        const since = anchor?.createdAt ?? item.createdAt;
        const key = `${kind}:${item.id}:${anchor?.id ?? "start"}`;
        // Esgotar cruza out e low no mesmo movimento: resolver o out resolve o low
        // dele, senao repor 1 unidade faria o low reaparecer como pendente.
        const resolveKeys =
          kind === "out" && ep.low !== null && ep.low.id === ep.out?.id
            ? [key, `low:${item.id}:${ep.low.id}`]
            : [key];
        const group = stockGroup(since, input);
        groups[group].push({
          kind,
          key,
          resolveKeys,
          group,
          resolved: isDone(resolveKeys),
          item,
          qty: ep.qty,
          since,
          sinceMovement: anchor,
          onList: listStatusOf(item, ep.qty, marks.get(item.id), prefs.autoList) !== "off",
          average: consumptionOf(item.id, own).average,
        });
      }
    }

    if (prefs.alertExpiring && ep.qty > 0 && item.expiresAt !== null) {
      const daysLeft = daysBetween(input.today, item.expiresAt);
      if (daysLeft <= prefs.expiringDays) {
        const key = `exp:${item.id}:${item.expiresAt}`;
        const resolveKeys = [key];
        const group = expiryGroup(daysLeft);
        groups[group].push({
          kind: "exp",
          key,
          resolveKeys,
          group,
          resolved: isDone(resolveKeys),
          item,
          qty: ep.qty,
          daysLeft,
        });
      }
    }
  }

  if (prefs.alertActivity) {
    for (const card of activityAlerts(input, done)) groups[card.group].push(card);
  }

  groups.today.sort(compareAlerts);
  groups.week.sort(compareAlerts);
  groups.older.sort(compareAlerts);
  const all = [...groups.today, ...groups.week, ...groups.older];
  return {
    ...groups,
    pending: all.filter((a) => !a.resolved).length,
    total: all.length,
  };
}
