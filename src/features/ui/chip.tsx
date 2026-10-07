export interface ChipProps {
  label: string;
  active: boolean;
  onClick: () => void;
}

export function Chip({ label, active, onClick }: ChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      class={`h-10 rounded-pill px-4 text-[13px] font-semibold ${
        active ? "bg-text text-bg" : "bg-surface text-text"
      }`}
    >
      {label}
    </button>
  );
}
