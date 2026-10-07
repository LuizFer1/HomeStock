import { Minus, Plus } from "lucide-preact";
import { useId } from "preact/hooks";

export interface CountStepperProps {
  label: string;
  hint?: string;
  value: number;
  min: number;
  max?: number; // padrao 999
  onChange: (value: number) => void;
}

const STEP =
  "grid size-11 shrink-0 place-items-center rounded-full bg-bg text-text disabled:opacity-45";

/** Stepper pequeno de 2d (markup linha 362): botoes 44 numa pilula `surface`. */
export function CountStepper({ label, hint, value, min, max = 999, onChange }: CountStepperProps) {
  const id = useId();
  return (
    // fieldset da o papel group; o rotulo fica num span (legend dentro de flex e instavel).
    <fieldset
      aria-labelledby={id}
      class="m-0 flex min-w-0 items-center justify-between gap-3 border-0 p-0"
    >
      <div class="min-w-0">
        <span id={id} class="block font-semibold text-[14px]">
          {label}
        </span>
        {hint !== undefined && <span class="block text-[12px] text-neutral-700">{hint}</span>}
      </div>
      <div class="flex shrink-0 items-center gap-1.5 rounded-pill bg-surface p-1">
        {/* O objeto no nome: dois steppers na mesma tela nao podem ter botoes iguais. */}
        <button
          type="button"
          aria-label={`Diminuir ${label}`}
          disabled={value <= min}
          onClick={() => onChange(value - 1)}
          class={STEP}
        >
          <Minus size={18} strokeWidth={2.75} />
        </button>
        <output class="w-9 text-center font-heading text-[22px]">{value}</output>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          disabled={value >= max}
          onClick={() => onChange(value + 1)}
          class={STEP}
        >
          <Plus size={18} strokeWidth={2.75} />
        </button>
      </div>
    </fieldset>
  );
}
