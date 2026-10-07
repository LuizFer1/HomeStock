import type { JSX } from "preact";

export interface TextFieldProps
  extends Omit<JSX.InputHTMLAttributes<HTMLInputElement>, "class" | "size"> {
  label: string;
  large?: boolean;
  class?: string;
}

const BASE =
  "w-full min-h-12 rounded-pill border border-divider bg-surface px-[14px] text-[14px] " +
  "text-text caret-accent placeholder:text-neutral-600 hover:border-text/45 focus-visible:border-accent";
const LARGE = "min-h-[60px] px-[22px] font-heading text-[22px]";

export function TextField({ label, large = false, class: extra, ...rest }: TextFieldProps) {
  return (
    <input
      type="text"
      {...rest}
      aria-label={label}
      class={`${BASE} ${large ? LARGE : ""} ${extra ?? ""}`}
    />
  );
}
