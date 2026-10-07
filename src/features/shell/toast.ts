import { type ReadonlySignal, signal } from "@preact/signals";

export const TOAST_MS = 4000;

export interface ToastAction {
  label: string;
  run: () => Promise<void>;
}

export interface ToastMessage {
  /** Cresce a cada show: a view usa como key para remontar e reiniciar a guarda. */
  id: number;
  text: string;
  action: ToastAction | null;
}

export interface ToastStore {
  current: ReadonlySignal<ToastMessage | null>;
  /** Substitui o toast atual e reinicia os 4s. */
  show: (text: string, action?: ToastAction) => void;
  /** Sem id, fecha o atual; com id, so fecha se ainda for ele (timer velho nao fecha o novo). */
  dismiss: (id?: number) => void;
}

/**
 * Um toast por vez, no shell: o desfazer precisa sobreviver a troca de tela
 * (deletar no sheet e o toast no Estoque; o stepper no Detalhe).
 */
export function createToastStore(): ToastStore {
  const current = signal<ToastMessage | null>(null);
  let nextId = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  function clear() {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  }

  function dismiss(id?: number) {
    const now = current.value;
    if (now === null) return;
    if (id !== undefined && id !== now.id) return;
    clear();
    current.value = null;
  }

  function show(text: string, action?: ToastAction) {
    clear();
    nextId += 1;
    const id = nextId;
    current.value = { id, text, action: action ?? null };
    timer = setTimeout(() => {
      timer = null;
      dismiss(id);
    }, TOAST_MS);
  }

  return { current, show, dismiss };
}
