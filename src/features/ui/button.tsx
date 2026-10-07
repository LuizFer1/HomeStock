import type { ComponentChildren, JSX } from "preact";

export type ButtonVariant = "primary" | "secondary" | "ghost";

/** Classes, nao so componente: label de arquivo precisa da mesma cara. */
export const BTN_BASE =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-pill " +
  "font-heading text-[14px] leading-tight disabled:cursor-not-allowed disabled:opacity-45";
export const BTN_PRIMARY = `${BTN_BASE} px-5 bg-accent text-bg hover:bg-accent-600 active:bg-accent-700`;
export const BTN_SECONDARY = `${BTN_BASE} px-5 border border-divider text-text hover:bg-text/[0.07] active:bg-text/[0.14]`;
export const BTN_GHOST = `${BTN_BASE} px-2 text-accent-700 hover:bg-accent/10 active:bg-accent/[0.18]`;

const VARIANT_CLASS: Record<ButtonVariant, string> = {
  primary: BTN_PRIMARY,
  secondary: BTN_SECONDARY,
  ghost: BTN_GHOST,
};

export interface ButtonProps extends Omit<JSX.ButtonHTMLAttributes<HTMLButtonElement>, "class"> {
  variant?: ButtonVariant;
  block?: boolean;
  class?: string;
  children: ComponentChildren;
}

/** `class` extra so adiciona utilitarios; nao sobrescreve os da base (ordem do CSS decide). */
export function Button({
  variant = "primary",
  block = false,
  class: extra,
  type = "button",
  children,
  ...rest
}: ButtonProps) {
  const classes = [VARIANT_CLASS[variant], block ? "w-full" : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} type={type} class={classes}>
      {children}
    </button>
  );
}
