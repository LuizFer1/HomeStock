import { useRef } from "preact/hooks";
import type { ToastMessage, ToastStore } from "./toast";

interface ToastPillProps {
  message: ToastMessage;
  store: ToastStore;
  raised: boolean;
}

function ToastPill({ message, store, raised }: ToastPillProps) {
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
      class={`fixed inset-x-[22px] mx-auto max-w-[436px] ${raised ? "bottom-[164px]" : "bottom-[100px]"} z-30 flex items-center gap-[10px] rounded-pill bg-text py-2 pr-2 pl-[18px] text-bg shadow-md`}
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
export function ToastView({ store, raised }: { store: ToastStore; raised: boolean }) {
  const message = store.current.value;
  // A regiao `status` fica sempre montada: uma regiao viva que nasce junto com
  // o texto nem sempre e anunciada.
  return (
    <div role="status">
      {message !== null && (
        <ToastPill key={message.id} message={message} store={store} raised={raised} />
      )}
    </div>
  );
}
