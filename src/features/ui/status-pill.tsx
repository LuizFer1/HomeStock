import type { ComponentChildren } from "preact";

export type StatusPillTone = "found" | "neutral";

// Classes completas por tom (o Tailwind so gera o que aparece inteiro no codigo).
const TONES: Record<
  StatusPillTone,
  { pill: string; circle: string; title: string; subtitle: string }
> = {
  // Banner "Achamos!" do markup 2d (linhas 353 a 356).
  found: {
    pill: "bg-accent-2-200",
    circle: "bg-accent-2-700 text-bg",
    title: "text-accent-2-900",
    subtitle: "text-accent-2-800",
  },
  // Nota de codigo novo: mesma pilula sobre a superficie.
  neutral: {
    pill: "bg-surface",
    circle: "bg-text text-bg",
    title: "text-text",
    subtitle: "text-neutral-700",
  },
};

export interface StatusPillProps {
  tone: StatusPillTone;
  /** Icone de 18 px; decorativo. */
  icon: ComponentChildren;
  title: string;
  subtitle: string;
  /** Id do bloco de texto, para o `aria-describedby` de quem recebe o foco. */
  textId: string;
}

/** Pilula de status com circulo de icone, titulo 13/600 e subtitulo 11. */
export function StatusPill({ tone, icon, title, subtitle, textId }: StatusPillProps) {
  const t = TONES[tone];
  return (
    <div
      role="status"
      class={`mt-3 flex items-center gap-[10px] rounded-pill ${t.pill} py-2 pr-4 pl-2`}
    >
      <span
        aria-hidden="true"
        class={`grid size-9 flex-none place-items-center rounded-full ${t.circle}`}
      >
        {icon}
      </span>
      <div id={textId} class="min-w-0">
        <p class={`font-semibold text-[13px] ${t.title}`}>{title}</p>
        <p class={`text-[11px] ${t.subtitle}`}>{subtitle}</p>
      </div>
    </div>
  );
}
