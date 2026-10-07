import type { VNode } from "preact";
import { useEffect } from "preact/hooks";
import { MemberWizard } from "./features/onboarding/member-wizard";
import type { Session } from "./features/session/session";
import { PlacesPage } from "./features/settings/places-page";
import { SettingsPage } from "./features/settings/settings-page";
import type { SettingsStore } from "./features/settings/store";
import { closeIfStill, type Router, type Screen } from "./features/shell/route";
import type { UpdateStore } from "./features/update/store";

/** Tudo que as telas recebem, montado uma vez no `main.tsx`. */
export interface AppContext {
  router: Router;
  session: Session;
  update: UpdateStore;
  settings: SettingsStore;
  /** Pipeline da foto de perfil (o antigo `processFile`). */
  processAvatar: (file: Blob) => Promise<string>;
  onLeave: () => Promise<void>;
}

export type ScreenRender = (screen: Screen, ctx: AppContext) => VNode | null;

/**
 * Tela que esta versao nao conhece (historico velho, link antigo): volta em
 * vez de prender o app numa tela em branco.
 */
export function UnknownScreen({ onBack }: { onBack: () => void }) {
  useEffect(() => {
    onBack();
  }, [onBack]);
  return null;
}

function ProfileScreen({ ctx }: { ctx: AppContext }) {
  const { router, session, settings } = ctx;
  const me = session.localMember.value;
  if (me === null) return <UnknownScreen onBack={router.back} />;
  return (
    <MemberWizard
      mode="edit"
      initial={{ name: me.name, color: me.color, photo: me.photo }}
      onSubmit={async (draft) => {
        const depth = router.stack.value.length;
        await settings.saveProfile(draft);
        closeIfStill(router, depth, "profile");
      }}
      onCancel={router.back}
      processFile={ctx.processAvatar}
    />
  );
}

export const SCREENS: Readonly<Record<string, ScreenRender>> = {
  settings: (_s, ctx) => (
    <SettingsPage
      session={ctx.session}
      store={ctx.settings}
      version={ctx.update.version}
      onBack={ctx.router.back}
      onEditProfile={() => ctx.router.push({ kind: "profile" })}
      onOpenPlaces={() => ctx.router.push({ kind: "places" })}
      onLeave={ctx.onLeave}
    />
  ),
  places: (_s, ctx) => (
    <PlacesPage session={ctx.session} store={ctx.settings} onBack={ctx.router.back} />
  ),
  // Componente e nao funcao: le o morador como sinal e reage a gravacao.
  profile: (_s, ctx) => <ProfileScreen ctx={ctx} />,
};

/** Desconhecida ou render que devolve null -> UnknownScreen. */
export function renderScreen(screen: Screen, ctx: AppContext): VNode {
  // `hasOwn`: um `kind` "toString" de historico velho nao pode achar o prototipo.
  const render = Object.hasOwn(SCREENS, screen.kind) ? SCREENS[screen.kind] : undefined;
  return render?.(screen, ctx) ?? <UnknownScreen onBack={ctx.router.back} />;
}
