/**
 * Abre o <dialog> como modal e devolve o foco a `opener` ao fechar. Liga uma vez:
 * [data-dialog-close] fecha; clique no proprio <dialog> (fora do cartao) fecha.
 * Esc e foco preso sao do navegador (showModal).
 */
export function bindDialog(dialog: HTMLDialogElement): {
  open(opener: HTMLElement | null): void;
  close(): void;
} {
  let opener: HTMLElement | null = null;

  const restoreFocus = () => {
    opener?.focus();
    opener = null;
  };

  const close = () => {
    if (typeof dialog.close === "function" && dialog.hasAttribute("open")) dialog.close();
    else dialog.removeAttribute("open");
    // close() dispara o evento "close", que devolve o foco; sem ele (fallback)
    // devolvemos aqui. Chamar duas vezes e inofensivo: opener ja foi zerado.
    restoreFocus();
  };

  for (const el of dialog.querySelectorAll("[data-dialog-close]")) {
    el.addEventListener("click", close);
  }
  // O alvo e o proprio <dialog> so quando o clique cai no fundo (::backdrop) ou
  // na margem: o cartao `.dialog` ocupa o resto e fica de fora.
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) close();
  });
  // Esc fecha pelo navegador sem passar por close(): o foco volta aqui.
  dialog.addEventListener("close", restoreFocus);

  return {
    open(from) {
      opener = from;
      if (typeof dialog.showModal === "function") {
        dialog.showModal();
      } else {
        dialog.setAttribute("open", "");
        dialog.querySelector<HTMLElement>("button, a[href], input")?.focus();
      }
    },
    close,
  };
}
