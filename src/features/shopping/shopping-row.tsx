import { Check } from "lucide-preact";
import type { JSX } from "preact";
import type { ShoppingEntry } from "../../domain/projections/shopping";
import { entryPrice, entryTitle } from "./labels";

export interface ShoppingRowProps {
  entry: ShoppingEntry;
  /** entryMeta ja resolvido (precisa dos moradores). */
  meta: string;
  onToggle: () => void;
}

/** Linha pilula de 2e (markup linhas 400 a 406 e 410 a 416). */
export function ShoppingRow({ entry, meta, onToggle }: ShoppingRowProps): JSX.Element {
  const title = entryTitle(entry);
  const on = entry.checked;
  const price = entryPrice(entry);
  return (
    <div class={`flex items-center rounded-pill bg-neutral-100 ${on ? "opacity-[0.55]" : ""}`}>
      {/* A linha inteira marca: e o gesto do mercado, com uma mao so. */}
      {/* biome-ignore lint/a11y/useSemanticElements: o input nativo nao embrulha o circulo, o nome e a meta como um alvo so */}
      <button
        type="button"
        role="checkbox"
        aria-checked={on}
        aria-label={`${title}, ${meta}`}
        onClick={onToggle}
        class="flex min-w-0 flex-1 items-center gap-3 rounded-pill py-2 pl-2 text-left"
      >
        <span
          aria-hidden="true"
          class={`grid size-10 flex-none place-items-center rounded-full border-3 ${
            on ? "border-accent-2-600 bg-accent-2-600 text-bg" : "border-neutral-400 bg-transparent"
          }`}
        >
          {on && <Check size={18} strokeWidth={2.75} />}
        </span>
        <span class="min-w-0 flex-1">
          <span class={`block truncate font-semibold text-[14px] ${on ? "line-through" : ""}`}>
            {title}
          </span>
          <span class="block text-[11px] text-neutral-700">{meta}</span>
        </span>
      </button>
      {/* So visual por enquanto: vira o botao "Ajustar" com nome proprio na proxima etapa. */}
      <span
        aria-hidden="true"
        class={`shrink-0 pr-4 pl-2 font-semibold text-[13px] ${price?.estimate ? "text-neutral-700" : ""}`}
      >
        {price?.text ?? ""}
      </span>
    </div>
  );
}
