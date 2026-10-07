import { useEffect } from "preact/hooks";
import type { Session } from "./features/session/session";
import type { Router, Screen, Tab } from "./features/shell/route";
import { TabBar } from "./features/shell/tab-bar";
import type { UpdateStore } from "./features/update/store";
import { UpdateBanner } from "./features/update/update-banner";

const TITLES: Record<Tab, string> = {
  home: "Início",
  stock: "Estoque",
  shopping: "Compras",
};

/**
 * Tela que esta versao nao conhece (historico velho, link antigo): volta em
 * vez de prender o app numa tela em branco.
 */
function UnknownScreen({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    onBack();
  }, [onBack]);
  return null;
}

function StackedScreen({ screen, router }: { screen: Screen; router: Router }) {
  switch (screen.kind) {
    default:
      return <UnknownScreen onBack={router.back} />;
  }
}

export function App({
  router,
  update,
  session,
}: {
  router: Router;
  update: UpdateStore;
  session: Session;
}) {
  const status = session.status.value;

  if (status === "loading") {
    return <div class="min-h-dvh bg-bg" aria-busy="true" />;
  }

  if (status === "error") {
    return (
      <main class="mx-auto min-h-dvh max-w-[480px] px-[22px] pt-11">
        <p role="alert" class="font-semibold text-[17px]">
          Não foi possível abrir o armazenamento deste aparelho.
        </p>
        <p class="mt-2 text-[15px] text-neutral-600">{session.error.value}</p>
      </main>
    );
  }

  const top = router.top.value;
  const tab = router.tab.value;
  const banner = update.ready.value && <UpdateBanner onApply={update.apply} />;

  if (top !== null) {
    return (
      <div class="mx-auto min-h-dvh max-w-[480px]">
        <StackedScreen screen={top} router={router} />
        {banner}
      </div>
    );
  }

  return (
    <div class="mx-auto min-h-dvh max-w-[480px]">
      <main class="no-scrollbar px-[22px] pt-11 pb-[110px]">
        <h1 class="text-[36px]">{TITLES[tab]}</h1>
      </main>
      {banner}
      <TabBar active={tab} onSelect={router.selectTab} onScan={() => {}} />
    </div>
  );
}
