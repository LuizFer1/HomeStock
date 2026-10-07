import type { VNode } from "preact";
import type { AppContext } from "./app-context";
import { AlertsPage } from "./features/alerts/alerts-page";
import { ItemDetailPage } from "./features/item/detail-page";
import { ItemForm } from "./features/item/item-form";
import { MemberWizard } from "./features/onboarding/member-wizard";
import { AddItemPage } from "./features/scanner/add-item-page";
import { PlacesPage } from "./features/settings/places-page";
import { SettingsPage } from "./features/settings/settings-page";
import { closeIfStill, type Screen } from "./features/shell/route";
import { UnknownScreen } from "./features/shell/unknown-screen";

export type ScreenRender = (screen: Screen, ctx: AppContext) => VNode | null;

interface ScreenProps {
  ctx: AppContext;
  screen: Screen;
}

function SettingsScreen({ ctx }: ScreenProps) {
  return (
    <SettingsPage
      session={ctx.session}
      store={ctx.settings}
      version={ctx.update.version}
      onBack={ctx.router.back}
      onEditProfile={() => ctx.router.push({ kind: "profile" })}
      onOpenPlaces={() => ctx.router.push({ kind: "places" })}
      onLeave={ctx.onLeave}
    />
  );
}

function AlertsScreen({ ctx }: ScreenProps) {
  return <AlertsPage ctx={ctx} />;
}

function PlacesScreen({ ctx }: ScreenProps) {
  return <PlacesPage session={ctx.session} store={ctx.settings} onBack={ctx.router.back} />;
}

function ProfileScreen({ ctx }: ScreenProps) {
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

/**
 * Convencao: toda entrada devolve so `<XScreen ctx={ctx} screen={s} />`. Leitura
 * de sinal e hook ficam dentro do componente da tela; lidos aqui, entrariam no
 * render do `App` e cada mudanca redesenharia o app inteiro.
 */
export const SCREENS = {
  settings: (s, ctx) => <SettingsScreen ctx={ctx} screen={s} />,
  places: (s, ctx) => <PlacesScreen ctx={ctx} screen={s} />,
  profile: (s, ctx) => <ProfileScreen ctx={ctx} screen={s} />,
  // Sem id nao ha item a mostrar: null cai no UnknownScreen e volta.
  item: (s, ctx) => (s.id ? <ItemDetailPage ctx={ctx} id={s.id} /> : null),
  "item-edit": (s, ctx) => (s.id ? <ItemForm ctx={ctx} mode="edit" id={s.id} /> : null),
  // FAB Escanear: a camera abre ao montar. Estoque vazio: a mesma tela, camera parada.
  // Pelo sino e pelo contador "vencendo" do Inicio.
  alerts: (s, ctx) => <AlertsScreen ctx={ctx} screen={s} />,
  scan: (_s, ctx) => <AddItemPage ctx={ctx} kind="scan" />,
  "item-new": (_s, ctx) => <AddItemPage ctx={ctx} kind="item-new" />,
} as const satisfies Readonly<Record<string, ScreenRender>>;

export type ScreenKind = keyof typeof SCREENS;

/** Desconhecida ou render que devolve null -> UnknownScreen. */
export function renderScreen(screen: Screen, ctx: AppContext): VNode {
  // `hasOwn`: um `kind` "toString" de historico velho nao pode achar o prototipo.
  const render: ScreenRender | undefined = Object.hasOwn(SCREENS, screen.kind)
    ? SCREENS[screen.kind as ScreenKind]
    : undefined;
  return render?.(screen, ctx) ?? <UnknownScreen onBack={ctx.router.back} />;
}
