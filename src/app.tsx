import { Fragment } from "preact";
import type { AppContext } from "./app-context";
import { MemberWizard } from "./features/onboarding/member-wizard";
import type { OnboardingStore } from "./features/onboarding/store";
import { TabBar } from "./features/shell/tab-bar";
import { ToastView } from "./features/shell/toast-view";
import { ShoppingPage } from "./features/shopping/shopping-page";
import { StockPage } from "./features/stock/stock-page";
import { Avatar } from "./features/ui/avatar";
import { UpdateBanner } from "./features/update/update-banner";
import { renderScreen } from "./screens";

export function App({ ctx, onboarding }: { ctx: AppContext; onboarding: OnboardingStore }) {
  const { router, session, update } = ctx;
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
        <MemberWizard
          mode="create"
          onSubmit={onboarding.complete}
          processFile={ctx.processAvatar}
        />
      </div>
    );
  }

  const top = router.top.value;
  const tab = router.tab.value;
  // O FAB abre o scanner; sem camera, a mesma tela aceita o codigo digitado.
  const openScanner = () => {
    // Do Estoque, como abrir um card: a lista volta na mesma posicao.
    if (tab === "stock") ctx.stock.scrollY.value = window.scrollY;
    router.push({ kind: "scan" });
  };
  const me = session.localMember.value;
  // Sobe para 164 px quando o aviso de versao (tambem a 100 px) esta visivel, e acima do
  // rodape fixo da aba Compras.
  const toast = (
    <ToastView
      store={ctx.toast}
      raised={update.ready.value}
      footer={top === null && tab === "shopping"}
    />
  );

  // Um so retorno com o toast e o aviso na mesma posicao: com dois ramos, a
  // regiao viva do toast remontava a cada push/pop e renascia ja com texto.
  return (
    <div class="mx-auto min-h-dvh max-w-[480px]">
      {top !== null ? (
        // A chave pela profundidade remonta a tela a cada pop: duas desconhecidas
        // seguidas reaproveitariam a instancia e o efeito de voltar nao rodaria.
        <Fragment key={router.stack.value.length}>{renderScreen(top, ctx)}</Fragment>
      ) : tab === "stock" ? (
        // A pagina traz o proprio `main` e le os sinais dentro dela.
        <StockPage ctx={ctx} />
      ) : tab === "shopping" ? (
        <ShoppingPage ctx={ctx} />
      ) : (
        // So o Inicio sobra: as outras abas trazem o proprio `main`.
        <main class="no-scrollbar px-[22px] pt-11 pb-[110px]">
          <div class="flex items-center justify-between">
            <h1 class="text-[36px]">Início</h1>
            <button
              type="button"
              aria-label="Ajustes"
              class="rounded-pill"
              onClick={() => router.push({ kind: "settings" })}
            >
              {/* Sem a linha do morador (apagada no sync), o botao fica: "Sair da casa" mora nos Ajustes. */}
              {me !== null ? (
                <Avatar name={me.name} color={me.color} photo={me.photo} size={40} />
              ) : (
                <Avatar name="" color="cacau" photo={null} size={40} />
              )}
            </button>
          </div>
        </main>
      )}
      {banner}
      {toast}
      {top === null && <TabBar active={tab} onSelect={router.selectTab} onScan={openScanner} />}
    </div>
  );
}
