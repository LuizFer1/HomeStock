import { Minus, Plus } from "lucide-preact";
import { useEffect, useId, useRef } from "preact/hooks";

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
  const dec = useRef<HTMLButtonElement>(null);
  const inc = useRef<HTMLButtonElement>(null);
  // Qual botao o ultimo toque usou: se ele desabilitou no limite, o foco cairia
  // no body (o navegador tira o foco de botao desabilitado) e o teclado se perde.
  const pressed = useRef<"dec" | "inc" | null>(null);

  useEffect(() => {
    const last = pressed.current;
    pressed.current = null;
    const from = last === "dec" ? dec.current : last === "inc" ? inc.current : null;
    const to = last === "dec" ? inc.current : dec.current;
    if (from === null || !from.disabled) return;
    const active = document.activeElement;
    if (active === from || active === null || active === document.body) to?.focus();
  }, [value, min, max]);

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
          ref={dec}
          disabled={value <= min}
          onClick={() => {
            pressed.current = "dec";
            onChange(value - 1);
          }}
          class={STEP}
        >
          <Minus size={18} strokeWidth={2.75} />
        </button>
        <output class="w-9 text-center font-heading text-[22px]">{value}</output>
        <button
          type="button"
          aria-label={`Aumentar ${label}`}
          ref={inc}
          disabled={value >= max}
          onClick={() => {
            pressed.current = "inc";
            onChange(value + 1);
          }}
          class={STEP}
        >
          <Plus size={18} strokeWidth={2.75} />
        </button>
      </div>
    </fieldset>
  );
}
