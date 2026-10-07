import { Check, Pencil } from "lucide-preact";
import type { JSX } from "preact";
import { useId } from "preact/hooks";
import type { ShoppingEntry } from "../../domain/projections/shopping";
import { entryPrice, entryTitle } from "./labels";

export interface ShoppingRowProps {
  entry: ShoppingEntry;
  /** entryMeta ja resolvido (precisa dos moradores). */
  meta: string;
  onToggle: () => void;
  /** Abre o sheet "Ajustar" da linha. */
  onAdjust: () => void;
}

/** Linha pilula de 2e (markup linhas 400 a 406 e 410 a 416). */
export function ShoppingRow({ entry, meta, onToggle, onAdjust }: ShoppingRowProps): JSX.Element {
  const title = entryTitle(entry);
  const on = entry.checked;
  const price = entryPrice(entry);
  const verbId = useId();
  const priceId = useId();
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
      {/* Irmao do botao da linha (nao aninha). Rotulo visivel dentro do nome (WCAG 2.5.3):
          "Ajustar {nome}," escondido + o preco visivel, por aria-labelledby. */}
      <button
        type="button"
        aria-labelledby={`${verbId} ${priceId}`}
        onClick={onAdjust}
        class="flex min-h-10 shrink-0 items-center gap-1 rounded-pill pr-4 pl-2 font-semibold text-[13px]"
      >
        <span id={verbId} hidden>
          {`Ajustar ${title},`}
        </span>
        {price === null ? (
          <span id={priceId} class="flex items-center gap-1 text-neutral-700">
            <Pencil size={14} strokeWidth={2.75} aria-hidden="true" />
            Preço
          </span>
        ) : (
          <span id={priceId} class={price.estimate ? "text-neutral-700" : ""}>
            {price.text}
          </span>
        )}
      </button>
    </div>
  );
}
