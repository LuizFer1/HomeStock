import type { Router, Tab } from "./features/shell/route";
import { TabBar } from "./features/shell/tab-bar";
import type { UpdateStore } from "./features/update/store";
import { UpdateBanner } from "./features/update/update-banner";

const TITLES: Record<Tab, string> = {
  home: "Início",
  stock: "Estoque",
  shopping: "Compras",
};

export function App({ router, update }: { router: Router; update: UpdateStore }) {
  const tab = router.tab.value;

  return (
    <div class="mx-auto min-h-dvh max-w-[480px]">
      <main class="no-scrollbar px-[22px] pt-11 pb-[110px]">
        <h1 class="text-[36px]">{TITLES[tab]}</h1>
      </main>
      {update.ready.value && <UpdateBanner onApply={update.apply} />}
      <TabBar active={tab} onSelect={router.selectTab} onScan={() => {}} />
    </div>
  );
}
