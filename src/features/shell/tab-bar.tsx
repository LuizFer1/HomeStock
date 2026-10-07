import { House, Package, ScanBarcode, ShoppingCart } from "lucide-preact";
import type { Tab } from "./route";

const TABS: ReadonlyArray<{ tab: Tab; label: string; Icon: typeof House }> = [
  { tab: "home", label: "Início", Icon: House },
  { tab: "stock", label: "Estoque", Icon: Package },
  { tab: "shopping", label: "Compras", Icon: ShoppingCart },
];

function TabButton({
  label,
  Icon,
  active,
  onSelect,
}: {
  label: string;
  Icon: typeof House;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      class={
        active
          ? "flex h-12 items-center gap-1.5 rounded-pill bg-bg px-4 text-[13px] font-semibold text-text"
          : "flex size-12 items-center justify-center rounded-pill text-neutral-300"
      }
    >
      <Icon size={active ? 18 : 22} strokeWidth={2.75} />
      {active && <span>{label}</span>}
    </button>
  );
}

/**
 * Tab bar flutuante do handoff: pilula escura com Inicio, Estoque, o FAB de
 * escanear no meio e Compras.
 */
export function TabBar({
  active,
  onSelect,
  onScan,
}: {
  active: Tab;
  onSelect: (tab: Tab) => void;
  onScan: () => void;
}) {
  const [home, stock, shopping] = TABS;
  if (!home || !stock || !shopping) return null;
  const button = (t: (typeof TABS)[number]) => (
    <TabButton
      key={t.tab}
      label={t.label}
      Icon={t.Icon}
      active={active === t.tab}
      onSelect={() => onSelect(t.tab)}
    />
  );

  return (
    <nav
      aria-label="Principal"
      class="fixed inset-x-4 bottom-[18px] z-20 mx-auto flex h-[68px] max-w-[420px] items-center justify-between rounded-pill bg-text px-2.5 shadow-md"
    >
      {button(home)}
      {button(stock)}
      <button
        type="button"
        onClick={onScan}
        aria-label="Escanear"
        class="flex size-[52px] items-center justify-center rounded-pill bg-accent text-bg"
      >
        <ScanBarcode size={22} strokeWidth={2.75} />
      </button>
      {button(shopping)}
    </nav>
  );
}
