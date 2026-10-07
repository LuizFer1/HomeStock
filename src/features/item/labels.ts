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
