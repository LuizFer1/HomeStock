import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import type { Location } from "../../domain/model/item";
import type { Member } from "../../domain/model/member";
import type { ActivityAlert, Alert, AlertGroup } from "../../domain/projections/alerts";
import { runsOutIn } from "../../domain/projections/consumption";
import { daysBetween } from "../../domain/projections/stock";
import { aboutDays } from "../item/labels";
import { localDayOf, pad } from "../session/today";

export type AlertActionKind = "use" | "list" | "view" | "ack";
export interface AlertActionLabel {
  kind: AlertActionKind;
  label: string;
}

export const GROUP_LABEL: Record<AlertGroup, string> = {
  today: "Hoje",
  week: "Esta semana",
  older: "Antes",
};

/** "Nada pendente" | "1 pendente" | "{n} pendentes". */
export function pendingLabel(n: number): string {
  if (n <= 0) return "Nada pendente";
  return n === 1 ? "1 pendente" : `${n} pendentes`;
}

/** "Alertas" sem pendentes; "Alertas, {pendingLabel}" com. */
export function bellLabel(n: number): string {
  return n > 0 ? `Alertas, ${pendingLabel(n)}` : "Alertas";
}

/** "8:12", "19:40": hora local sem zero a esquerda. */
export function clockOf(iso: string): string {
  const date = new Date(iso);
  return `${date.getHours()}:${pad(date.getMinutes())}`;
}

/** "03/10": dia e mes locais. */
export function dayMonthOf(iso: string): string {
  const date = new Date(iso);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
}

/** "Você" (morador local), nome do morador vivo, ou "Outro morador". */
export function whoName(id: Ulid | null, members: readonly Member[], localId: Ulid | null): string {
  if (id !== null && id === localId) return "Você";
  const member = id === null ? undefined : members.find((m) => m.id === id && isAlive(m));
  return member?.name ?? "Outro morador";
}

function activityTitle(alert: ActivityAlert, members: readonly Member[]): string {
  // O ator nunca e o morador local (a projecao os exclui): nunca "Voce".
  const who = whoName(alert.actorId, members, null);
  const n = alert.entries.length;
  const [only] = alert.entries;
  if (alert.activity === "request") {
    return `${who} adicionou ${n === 1 ? "1 item" : `${n} itens`} à lista`;
  }
  const verb = alert.activity === "use" ? "usou" : "guardou";
  if (n === 1 && only !== undefined)
    return `${who} ${verb} ${only.qty} ${only.unit} de ${only.name}`;
  return `${who} ${verb} ${n} itens`;
}

export function alertTitle(alert: Alert, members: readonly Member[]): string {
  if (alert.kind === "activity") return activityTitle(alert, members);
  const name = alert.item.name;
  switch (alert.kind) {
    case "out":
      return `${name} esgotou`;
    case "low":
      return `${name} abaixo do mínimo`;
    case "exp": {
      const d = alert.daysLeft;
      if (d < 0) return `${name} venceu`;
      if (d === 0) return `${name} vence hoje`;
      if (d === 1) return `${name} vence amanhã`;
      return `${name} vence em ${d} dias`;
    }
  }
}

export interface MetaContext {
  members: readonly Member[];
  locations: readonly Location[];
  localId: Ulid | null;
  today: string;
}

const ON_LIST = "já está na lista";

/** "A", "A e B", "A, B e C", "A, B e mais {n-2}". */
function namesOf(names: readonly string[]): string {
  if (names.length <= 2) return names.join(" e ");
  if (names.length === 3) return `${names[0]}, ${names[1]} e ${names[2]}`;
  return `${names[0]}, ${names[1]} e mais ${names.length - 2}`;
}

function activityMeta(alert: ActivityAlert, today: string): string {
  const d = daysBetween(alert.day, today);
  const clock = clockOf(alert.at);
  const when =
    d <= 0 ? `hoje, ${clock}` : d === 1 ? `ontem, ${clock}` : `${dayMonthOf(alert.at)}, ${clock}`;
  return `${namesOf(alert.entries.map((e) => e.name))} · ${when}`;
}

export function alertMeta(alert: Alert, ctx: MetaContext): string {
  if (alert.kind === "activity") return activityMeta(alert, ctx.today);
  const parts: (string | null)[] = [];
  switch (alert.kind) {
    case "out": {
      const m = alert.sinceMovement;
      if (m !== null) {
        const d = daysBetween(localDayOf(m.createdAt), ctx.today);
        const when =
          d <= 0
            ? `às ${clockOf(m.createdAt)}`
            : d === 1
              ? "ontem"
              : `em ${dayMonthOf(m.createdAt)}`;
        parts.push(`${whoName(m.authorId, ctx.members, ctx.localId)} registrou ${when}`);
      }
      parts.push(alert.onList ? ON_LIST : null);
      break;
    }
    case "low": {
      const { item } = alert;
      parts.push(`${Math.max(0, alert.qty)} de ${item.min} ${item.unit}`);
      const days = runsOutIn(alert.qty, alert.average);
      parts.push(days !== null && days > 0 ? `acaba em ${aboutDays(days)}` : null);
      parts.push(alert.onList ? ON_LIST : null);
      break;
    }
    case "exp": {
      const { item } = alert;
      parts.push(`${alert.qty} ${item.unit}`);
      const place = ctx.locations.find((l) => l.id === item.locationId && isAlive(l));
      parts.push(place?.name ?? null);
      break;
    }
  }
  return parts.filter((p): p is string => p !== null).join(" · ");
}

/** Exp -> use "Marcar como usado"; out/low -> list "Adicionar à lista" ou view "Ver item". */
export function alertAction(alert: Alert): AlertActionLabel {
  if (alert.kind === "activity") {
    const [only] = alert.entries;
    return alert.activity !== "request" && alert.entries.length === 1 && only?.itemAlive === true
      ? { kind: "view", label: "Ver item" }
      : { kind: "ack", label: "Entendi" };
  }
  if (alert.kind === "exp") return { kind: "use", label: "Marcar como usado" };
  return alert.onList
    ? { kind: "view", label: "Ver item" }
    : { kind: "list", label: "Adicionar à lista" };
}
