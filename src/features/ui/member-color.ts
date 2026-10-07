import type { MemberColor } from "../../domain/model/member";

export interface MemberColorStyle {
  label: string;
  fill: string;
  ink: string;
}

/** Cores do passo 2 do handoff. Damasco e Pistache sao claras: inicial em `text`. */
export const MEMBER_COLOR_STYLE: Record<MemberColor, MemberColorStyle> = {
  terracota: { label: "Terracota", fill: "var(--color-accent)", ink: "var(--color-bg)" },
  salvia: { label: "Sálvia", fill: "var(--color-accent-2)", ink: "var(--color-bg)" },
  canela: { label: "Canela", fill: "var(--color-accent-700)", ink: "var(--color-bg)" },
  musgo: { label: "Musgo", fill: "var(--color-accent-2-700)", ink: "var(--color-bg)" },
  damasco: { label: "Damasco", fill: "var(--color-accent-400)", ink: "var(--color-text)" },
  pistache: { label: "Pistache", fill: "var(--color-accent-2-400)", ink: "var(--color-text)" },
  cafe: { label: "Café", fill: "var(--color-neutral-800)", ink: "var(--color-bg)" },
  cacau: { label: "Cacau", fill: "var(--color-accent-900)", ink: "var(--color-bg)" },
};
