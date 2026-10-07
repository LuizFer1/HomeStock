import { RefreshCw } from "lucide-preact";

/**
 * Aviso discreto, nao modal: a versao nova pode esperar a pessoa terminar o
 * que esta fazendo. Atualizar recarrega a tela, entao a decisao e dela.
 */
export function UpdateBanner({ onApply }: { onApply: () => void }) {
  return (
    <div
      role="status"
      class="fixed inset-x-4 bottom-[100px] z-30 mx-auto flex max-w-[420px] items-center gap-3 rounded-pill bg-text py-2 pr-2 pl-4 text-sm text-bg shadow-md"
    >
      <RefreshCw size={18} strokeWidth={2.75} />
      <p class="min-w-0 flex-1">Nova versão disponível</p>
      <button
        type="button"
        onClick={onApply}
        class="shrink-0 rounded-pill bg-accent px-4 py-2 font-semibold text-bg"
      >
        Atualizar
      </button>
    </div>
  );
}
