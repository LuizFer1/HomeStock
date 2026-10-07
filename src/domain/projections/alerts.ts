import { compareHlc } from "../clock/hlc";
import type { Ulid } from "../ids/ulid";
import { type AlertState, resolvedKeys } from "../model/alert-state";
import { isAlive } from "../model/base";
import type { Item } from "../model/item";
import type { ListExtra } from "../model/list-extra";
import type { ListMark } from "../model/list-mark";
import type { Movement } from "../model/movement";
import type { PrefValues } from "../model/prefs";
import { consumptionOf } from "./consumption";
import { listStatusOf, liveMarkOf } from "./shopping";
import { daysBetween } from "./stock";

export type AlertGroup = "today" | "week" | "older";

interface AlertBase {
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

export type Alert = StockAlert | ExpiryAlert;

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
const KIND_ORDER: Record<Alert["kind"], number> = { out: 0, low: 1, exp: 2 };

function compareAlerts(a: Alert, b: Alert): number {
  const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind];
  if (byKind !== 0) return byKind;
  if (a.kind === "exp" && b.kind === "exp" && a.daysLeft !== b.daysLeft) {
    return a.daysLeft - b.daysLeft;
  }
  return collator.compare(a.item.name, b.item.name);
}

function stockGroup(since: string, input: AlertInput): AlertGroup {
  const d = daysBetween(input.dayOf(since), input.today);
  return d <= 0 ? "today" : d <= 6 ? "week" : "older";
}

function expiryGroup(daysLeft: number): AlertGroup {
  if (daysLeft >= 0 && daysLeft <= 1) return "today";
  return daysLeft >= -6 ? "week" : "older";
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
        const resolveKeys = [key];
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
          onList:
            listStatusOf(
              item,
              ep.qty,
              liveMarkOf(item, input.movements, input.listMarks),
              prefs.autoList,
            ) !== "off",
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
