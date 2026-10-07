import { useEffect } from "preact/hooks";
import { MemberWizard } from "./features/onboarding/member-wizard";
import type { OnboardingStore } from "./features/onboarding/store";
import type { Session } from "./features/session/session";
import { SettingsPage } from "./features/settings/settings-page";
import type { SettingsStore } from "./features/settings/store";
import type { Router, Screen, Tab } from "./features/shell/route";
import { TabBar } from "./features/shell/tab-bar";
import { Avatar } from "./features/ui/avatar";
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

interface StackedProps {
  screen: Screen;
  router: Router;
  session: Session;
  settings: SettingsStore;
  version: string | null;
  processFile: (file: Blob) => Promise<string>;
}

function StackedScreen({ screen, router, session, settings, version, processFile }: StackedProps) {
  const me = session.localMember.value;
  switch (screen.kind) {
    case "settings":
      return (
        <SettingsPage
          session={session}
          store={settings}
          version={version}
          onBack={router.back}
          onEditProfile={() => router.push({ kind: "profile" })}
          onOpenPlaces={() => router.push({ kind: "places" })}
        />
      );
    case "profile":
      if (me === null) return <UnknownScreen onBack={router.back} />;
      return (
        <MemberWizard
          mode="edit"
          initial={{ name: me.name, color: me.color, photo: me.photo }}
          onSubmit={async (draft) => {
            const depth = router.stack.value.length;
            await settings.saveProfile(draft);
            // Voltar do sistema durante a gravacao ja desempilhou: outro back sairia da tela de baixo.
            if (router.stack.value.length === depth && router.top.value?.kind === "profile") {
              router.back();
            }
          }}
          onCancel={router.back}
          processFile={processFile}
        />
      );
    default:
      return <UnknownScreen onBack={router.back} />;
  }
}

export function App({
  router,
  update,
  session,
  onboarding,
  settings,
  processFile,
}: {
  router: Router;
  update: UpdateStore;
  session: Session;
  onboarding: OnboardingStore;
  settings: SettingsStore;
  processFile: (file: Blob) => Promise<string>;
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

  const banner = update.ready.value && <UpdateBanner onApply={update.apply} />;

  if (onboarding.needsOnboarding.value) {
    return (
      <div class="mx-auto min-h-dvh max-w-[480px]">
        {/* Sem UpdateBanner: ele e fixed acima da tab bar e cobriria o CTA do wizard. */}
        <MemberWizard mode="create" onSubmit={onboarding.complete} processFile={processFile} />
      </div>
    );
  }

  const top = router.top.value;
  const tab = router.tab.value;
  const me = session.localMember.value;

  if (top !== null) {
    return (
      <div class="mx-auto min-h-dvh max-w-[480px]">
        {/* A chave pela profundidade remonta a tela a cada pop: duas desconhecidas
            seguidas reaproveitariam a instancia e o efeito de voltar nao rodaria. */}
        <StackedScreen
          key={router.stack.value.length}
          screen={top}
          router={router}
          session={session}
          settings={settings}
          version={update.version}
          processFile={processFile}
        />
        {banner}
      </div>
    );
  }

  return (
    <div class="mx-auto min-h-dvh max-w-[480px]">
      <main class="no-scrollbar px-[22px] pt-11 pb-[110px]">
        {tab === "home" ? (
          <div class="flex items-center justify-between">
            <h1 class="text-[36px]">{TITLES[tab]}</h1>
            {me !== null ? (
              <button
                type="button"
                aria-label="Ajustes"
                class="rounded-pill"
                onClick={() => router.push({ kind: "settings" })}
              >
                <Avatar name={me.name} color={me.color} photo={me.photo} size={40} />
              </button>
            ) : null}
          </div>
        ) : (
          <h1 class="text-[36px]">{TITLES[tab]}</h1>
        )}
      </main>
      {banner}
      <TabBar active={tab} onSelect={router.selectTab} onScan={() => {}} />
    </div>
  );
}
