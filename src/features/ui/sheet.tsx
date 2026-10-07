import type { ComponentChildren } from "preact";
import { useEffect, useRef } from "preact/hooks";

export interface SheetProps {
  open: boolean;
  /** Nome acessivel do dialogo. */
  label: string;
  onClose: () => void;
  children: ComponentChildren;
}

/**
 * Action sheet sobre `<dialog>` nativo (porte enxuto do `Modal` do HomeFinance,
 * sem arraste): foco preso, Esc e `inert` no resto da pagina de graca.
 */
export function Sheet({ open, label, onClose, children }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog === null) return;
    // `showModal` lanca se ja estiver aberto; conferir `open` evita isso e o
    // `close` redundante.
    if (open && !dialog.open) {
      opener.current = document.activeElement as HTMLElement | null;
      dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  // Roda no `close` nativo, que vem tanto do Esc quanto do `close()` acima.
  function handleClose() {
    const dialog = ref.current;
    const back = opener.current;
    opener.current = null;
    // O navegador ja devolve o foco a quem abriu; repetimos por garantia (nem
    // todo motor faz), so se ele ainda existe (card deletado nao) e se quem
    // fechou nao mandou o foco para outro lugar.
    const active = document.activeElement;
    const lost = active === null || active === document.body || (dialog?.contains(active) ?? false);
    if (back?.isConnected && lost) back.focus();
    onClose();
  }

  return (
    // O equivalente de teclado do clique no backdrop e o Esc, que o <dialog>
    // nativo ja trata e que chega aqui pelo evento `close`.
    // biome-ignore lint/a11y/useKeyWithClickEvents: ver comentario acima
    <dialog
      ref={ref}
      aria-label={label}
      // Sem isto, fechar com Esc deixaria `open` verdadeiro do lado de fora e o
      // sheet nao reabriria.
      onClose={handleClose}
      onClick={(event) => {
        // O alvo so e o proprio dialog quando o clique caiu fora do painel.
        if (event.target === ref.current) onClose();
      }}
      class="m-0 mx-auto mt-auto w-full max-w-[480px] bg-transparent p-0 backdrop:bg-neutral-900/45"
    >
      <div class="sheet-enter rounded-t-[36px] bg-bg px-5 pt-[10px] pb-7 shadow-lg">
        <div
          aria-hidden="true"
          class="mx-auto mb-[14px] h-[5px] w-11 rounded-pill bg-neutral-300"
        />
        {children}
      </div>
    </dialog>
  );
}
