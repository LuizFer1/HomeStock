import type { Item } from "../../domain/model/item";
import { runsOutIn } from "../../domain/projections/consumption";
import { daysBetween, type ItemStatus, type PrimaryStatus } from "../../domain/projections/stock";

// A mesma regra do avatar do morador (Array.from por emoji, "?" sem nome).
export { initialOf } from "../ui/avatar";

export type BlobTone = { fill: string; ink: string };

/** Cores do blob por status (BLOB da classe Component). Classes Tailwind completas. */
export const BLOB: Record<PrimaryStatus, BlobTone> = {
  low: { fill: "bg-accent-200", ink: "text-accent-900" },
  out: { fill: "bg-accent", ink: "text-bg" },
  exp: { fill: "bg-accent-2-200", ink: "text-accent-2-900" },
  ok: { fill: "bg-neutral-200", ink: "text-neutral-800" },
};

/** "~1 dia", "~5 dias", "~2 semanas", "~1 mês", "~3 meses". */
export function aboutDays(days: number): string {
  const n = Math.round(days);
  if (n <= 1) return "~1 dia";
  if (n <= 13) return `~${n} dias`;
  if (n <= 29) {
    const weeks = Math.round(n / 7);
    return `~${weeks} ${weeks === 1 ? "semana" : "semanas"}`;
  }
  const months = Math.round(n / 30);
  return `~${months} ${months === 1 ? "mês" : "meses"}`;
}

/** "Venceu" | "Vence hoje" | "Vence amanhã" | "Vence em N dias", ou null sem validade. */
export function expiryNote(expiresAt: string | null, today: string): string | null {
  if (expiresAt === null) return null;
  const days = daysBetween(today, expiresAt);
  if (days < 0) return "Venceu";
  if (days === 0) return "Vence hoje";
  if (days === 1) return "Vence amanhã";
  return `Vence em ${days} dias`;
}

/** Nota do card: Esgotado, Abaixo do minimo, nota de validade, "Dura ~x" ou "Em dia". */
export function statusNote(
  status: ItemStatus,
  item: Item,
  qty: number,
  average: number | null,
  today: string,
): string {
  switch (status.primary) {
    case "out":
      return "Esgotado";
    case "low":
      return "Abaixo do mínimo";
    case "exp":
      return expiryNote(item.expiresAt, today) ?? "Em dia";
    case "ok": {
      // Quanto dura o que ha em casa no ritmo de consumo; sem media, nada a prever.
      const days = runsOutIn(qty, average);
      return days === null || days <= 0 ? "Em dia" : `Dura ${aboutDays(days)}`;
    }
  }
}

const STEPPER_STATUS: Record<PrimaryStatus, string> = {
  out: "esgotado",
  low: "abaixo do mínimo",
  exp: "vencendo",
  ok: "em dia",
};

/** "esgotado" | "abaixo do mínimo" | "vencendo" | "em dia". */
export function stepperStatus(primary: PrimaryStatus): string {
  return STEPPER_STATUS[primary];
}

/** "Nenhum" com min 0, senao "{min} {unidade}". */
export function minimumChip(item: Item): string {
  return item.min > 0 ? `${item.min} ${item.unit}` : "Nenhum";
}

// Fixo e nao Intl: a saida nao depende do motor (o Intl poe ponto em "abr.").
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** "Sem data", "Venceu", "Hoje", "Amanhã", "Em N dias" (ate expDays), senao "abr 2027". */
export function expiryChip(expiresAt: string | null, today: string, expDays: number): string {
  if (expiresAt === null) return "Sem data";
  const days = daysBetween(today, expiresAt);
  if (days < 0) return "Venceu";
  if (days === 0) return "Hoje";
  if (days === 1) return "Amanhã";
  if (days <= expDays) return `Em ${days} dias`;
  const [year, month] = expiresAt.split("-");
  return `${MONTHS[Number(month) - 1]} ${year}`;
}

/** "Acabou" com qty <= 0, aboutDays(runsOutIn) com media, "Sem dados" sem media. */
export function runsOutChip(qty: number, average: number | null): string {
  if (qty <= 0) return "Acabou";
  const days = runsOutIn(qty, average);
  return days === null ? "Sem dados" : aboutDays(days);
}

/** "1 pct a cada ~8 dias" ou "Sem histórico ainda". */
export function consumptionLegend(unit: string, average: number | null): string {
  return average === null ? "Sem histórico ainda" : `1 ${unit} a cada ${aboutDays(average)}`;
}

/** "9d" ou "<1d". */
export function barLabel(days: number): string {
  const n = Math.round(days);
  return n < 1 ? "<1d" : `${n}d`;
}

/** Altura em %: max(8, round(d / max(10, maior) * 100)). */
export function barHeights(days: readonly number[]): number[] {
  // Escala de pelo menos 10 dias: dois usos no mesmo dia nao viram barras cheias.
  const scale = Math.max(10, ...days);
  return days.map((d) => Math.max(8, Math.round((d / scale) * 100)));
}

/** Nome do grafico para leitor de tela: "Dias por unidade, ...: 9, 8, 10". */
export function consumptionAria(days: readonly number[]): string {
  const values = days.map((d) => {
    const n = Math.round(d);
    return n < 1 ? "menos de 1" : String(n);
  });
  return `Dias por unidade, do mais antigo ao mais novo: ${values.join(", ")}`;
}

const MONEY = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** "R$ 42,90" (Intl pt-BR BRL). */
export function formatMoney(minor: number): string {
  return MONEY.format(minor / 100);
}
