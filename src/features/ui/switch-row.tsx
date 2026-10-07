import { useId } from "preact/hooks";

export interface SwitchRowProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A linha inteira e o alvo de toque; o checkbox sr-only deixa foco e anuncio com o navegador. */
export function SwitchRow({ label, hint, checked, onChange }: SwitchRowProps) {
  const labelId = useId();
  const hintId = useId();
  return (
    <label class="flex min-h-[60px] cursor-pointer items-center justify-between gap-3 py-1.5">
      <span class="flex flex-col">
        <span id={labelId} class="text-[14px] font-semibold">
          {label}
        </span>
        {hint ? (
          <span id={hintId} class="text-[12px] text-neutral-700">
            {hint}
          </span>
        ) : null}
      </span>
      <input
        type="checkbox"
        role="switch"
        aria-checked={checked}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        class="peer sr-only"
        checked={checked}
        onChange={(event) => onChange(event.currentTarget.checked)}
      />
      <span
        aria-hidden="true"
        class={`flex h-8 w-[52px] shrink-0 items-center rounded-pill p-1 peer-focus-visible:outline-2 peer-focus-visible:outline-accent peer-focus-visible:outline-offset-2 ${
          checked ? "justify-end bg-accent-2-600" : "justify-start bg-neutral-300"
        }`}
      >
        <span class="size-6 rounded-pill bg-bg shadow-sm" />
      </span>
    </label>
  );
}
