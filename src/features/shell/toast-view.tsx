import { useRef } from "preact/hooks";
import type { ToastMessage, ToastStore } from "./toast";

interface ToastPillProps {
  message: ToastMessage;
  store: ToastStore;
  raised: boolean;
  footer: boolean;
}

// Na aba Compras o rodape fixo mora a 100 px: o toast sobe 92 px para nao cobrir o total e o Repor.
// Classes literais: o Tailwind so gera a classe escrita por inteiro.
const BOTTOM = {
  plain: "bottom-[100px]",
  raised: "bottom-[164px]",
  footer: "bottom-[192px]",
  both: "bottom-[256px]",
} as const;

function bottomClass(raised: boolean, footer: boolean): string {
  if (footer) return raised ? BOTTOM.both : BOTTOM.footer;
  return raised ? BOTTOM.raised : BOTTOM.plain;
}

function ToastPill({ message, store, raised, footer }: ToastPillProps) {
  // Trava por ref e nao estado: dois toques no mesmo render leriam o mesmo
  // estado velho e desfariam duas vezes. A key pelo id zera a trava a cada toast.
  const running = useRef(false);
  const { id, text, action } = message;

  async function onAction() {
    if (action === null || running.current) return;
    running.current = true;
    try {
      await action.run();
      // Com id: se outro toast entrou durante o await, ele fica.
      store.dismiss(id);
    } catch {
      store.show("Não foi possível desfazer.");
    }
  }

  return (
    <div
      class={`fixed inset-x-[22px] mx-auto max-w-[436px] ${bottomClass(raised, footer)} z-30 flex items-center gap-[10px] rounded-pill bg-text py-2 pr-2 pl-[18px] text-bg shadow-md`}
    >
      <span class="flex-1 font-semibold text-[13px]">{text}</span>
      {action !== null && (
        <button
          type="button"
          onClick={onAction}
          class="min-h-10 shrink-0 rounded-pill bg-bg px-4 font-semibold text-[13px] text-text"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}

/**
 * Toast do markup (2b, linhas 249 a 254). Nao move o foco ao aparecer: quem
 * esta no meio de outra coisa nao perde o lugar; o leitor de tela anuncia pela
 * regiao viva.
 */
export function ToastView({
  store,
  raised,
  footer = false,
}: {
  store: ToastStore;
  raised: boolean;
  /** Rodape fixo da aba Compras na tela: o toast sobe acima dele. */
  footer?: boolean;
}) {
  const message = store.current.value;
  // A regiao `status` fica sempre montada: uma regiao viva que nasce junto com
  // o texto nem sempre e anunciada.
  return (
    <div role="status">
      {message !== null && (
        <ToastPill
          key={message.id}
          message={message}
          store={store}
          raised={raised}
          footer={footer}
        />
      )}
    </div>
  );
}
