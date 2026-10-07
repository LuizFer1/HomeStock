import { Calendar, TriangleAlert } from "lucide-preact";
import type { JSX } from "preact";
import { useId } from "preact/hooks";
import type { Member } from "../../domain/model/member";
import type { Alert } from "../../domain/projections/alerts";
import { Avatar } from "../ui/avatar";
import { ErrorText } from "../ui/error-text";
import type { AlertActionLabel } from "./labels";

export interface AlertCardProps {
  alert: Alert;
  title: string;
  meta: string;
  /** null quando resolvido. */
  action: AlertActionLabel | null;
  /** Morador da atividade (Avatar); undefined nos outros tipos ou sem a linha dele. */
  actor?: Member;
  busy: boolean;
  error: string | null;
  onAction: () => void;
}

// Classes literais: o Tailwind so gera a classe escrita por inteiro.
const ICON = {
  exp: { tone: "bg-accent-2-200 text-accent-2-900", Icon: Calendar },
  out: { tone: "bg-accent-200 text-accent-900", Icon: TriangleAlert },
  low: { tone: "bg-accent-200 text-accent-900", Icon: TriangleAlert },
} as const;

/** Cartao de 2f (markup linhas 438 a 451). */
export function AlertCard({
  alert,
  title,
  meta,
  action,
  actor,
  busy,
  error,
  onAction,
}: AlertCardProps): JSX.Element {
  const titleId = useId();
  let icon: JSX.Element;
  if (alert.kind === "activity") {
    icon = (
      <span aria-hidden="true" class="flex-none">
        {actor === undefined ? (
          <Avatar name="" color="cacau" photo={null} size={44} />
        ) : (
          <Avatar name={actor.name} color={actor.color} photo={actor.photo} size={44} />
        )}
      </span>
    );
  } else {
    const { tone, Icon } = ICON[alert.kind];
    icon = (
      <span
        aria-hidden="true"
        class={`grid size-11 flex-none place-items-center rounded-full ${tone}`}
      >
        <Icon size={20} strokeWidth={2.75} />
      </span>
    );
  }

  return (
    <li
      data-alert-key={alert.key}
      tabIndex={-1}
      aria-labelledby={titleId}
      class={`flex gap-3 rounded-[28px] bg-surface p-[14px] ${alert.resolved ? "opacity-[0.55]" : ""}`}
    >
      {icon}
      <div class="min-w-0 flex-1">
        <p id={titleId} class="font-semibold text-[14px] leading-[1.3]">
          {title}
        </p>
        {meta !== "" && <p class="mt-[2px] text-[12px] text-neutral-700">{meta}</p>}
        {action !== null && (
          <button
            type="button"
            aria-label={`${action.label}, ${title}`}
            disabled={busy}
            onClick={onAction}
            class="mt-[10px] inline-flex min-h-10 items-center justify-center rounded-pill bg-accent px-4 font-heading text-[13px] text-bg hover:bg-accent-600 active:bg-accent-700 disabled:opacity-45"
          >
            {action.label}
          </button>
        )}
        {alert.resolved && (
          <span class="mt-[10px] inline-flex rounded-[12px] bg-accent-2-100 px-[10px] py-[3px] font-semibold text-[11px] text-accent-2-800 tracking-[0.02em]">
            Resolvido
          </span>
        )}
        {error !== null && (
          // A tela move o foco para ca quando a acao falha: o leitor ja le a mensagem.
          <div data-alert-error={alert.key} tabIndex={-1} class="mt-2">
            <ErrorText alert={false}>{error}</ErrorText>
          </div>
        )}
      </div>
    </li>
  );
}
