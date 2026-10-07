import type { ComponentChildren, JSX } from "preact";

export interface TextFieldProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "size" | "icon"> {
  /** `aria-label` do campo. Com `<label for>` visivel nao passe: o aria-label o sobrescreveria. */
  label?: string;
  id?: string;
  /** Variantes exclusivas: `large`, `dense` ou `icon`, uma so. */
  large?: boolean;
  /** 44 px de altura, os campos de 2d. */
  dense?: boolean;
  /** Icone decorativo a esquerda (a busca do Estoque). */
  icon?: ComponentChildren;
  class?: string;
}

const COMMON =
  "w-full rounded-pill border border-divider bg-surface " +
  "text-text caret-accent placeholder:text-neutral-600 hover:border-text/45 " +
  "focus-visible:border-accent focus-visible:outline-offset-0";
// Um ou outro, nunca empilhados: min-h, px e text conflitariam na ordem do CSS.
const NORMAL = `${COMMON} min-h-12 px-[14px] text-[14px]`;
const LARGE = `${COMMON} min-h-[60px] px-[22px] font-heading text-[22px]`;
const DENSE = `${COMMON} min-h-11 px-[14px] text-[14px]`;
// `pr` e `pl` separados, sem `px`: o `px` brigaria com o `pl` do icone.
const ICON = `${COMMON} min-h-12 pr-[14px] pl-11 text-[14px]`;

export function TextField({
  label,
  id,
  large = false,
  dense = false,
  icon,
  class: extra,
  ...rest
}: TextFieldProps) {
  const hasIcon = icon !== undefined && icon !== null;
  const variant = large ? LARGE : dense ? DENSE : hasIcon ? ICON : NORMAL;
  const input = (
    <input type="text" {...rest} id={id} aria-label={label} class={`${variant} ${extra ?? ""}`} />
  );
  if (!hasIcon || large || dense) return input;
  return (
    <div class="relative">
      <span
        aria-hidden="true"
        class="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-700"
      >
        {icon}
      </span>
      {input}
    </div>
  );
}
