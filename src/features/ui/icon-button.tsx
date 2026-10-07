import type { ComponentChildren } from "preact";

export interface IconButtonProps {
  label: string;
  onClick: () => void;
  children: ComponentChildren;
  class?: string;
}

export function IconButton({ label, onClick, children, class: extra }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      class={`flex size-11 shrink-0 items-center justify-center rounded-pill border border-divider text-text hover:bg-text/[0.07] active:bg-text/[0.14] ${extra ?? ""}`}
    >
      {children}
    </button>
  );
}
