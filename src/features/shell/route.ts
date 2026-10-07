import { computed, type ReadonlySignal, signal } from "@preact/signals";

export type Tab = "home" | "stock" | "shopping";

/** Tela empilhada sobre a aba (detalhe, adicionar, ajustes). */
export interface Screen {
  kind: string;
  id?: string;
}

/** O pedaco de `window.history` que o roteador usa. */
export interface HistoryLike {
  pushState: (data: unknown, unused: string) => void;
  back: () => void;
}

export interface Router {
  tab: ReadonlySignal<Tab>;
  stack: ReadonlySignal<readonly Screen[]>;
  /** Tela no topo da pilha, ou null quando a aba esta a mostra. */
  top: ReadonlySignal<Screen | null>;
  selectTab: (tab: Tab) => void;
  push: (screen: Screen) => void;
  /** Voltar da UI: passa pelo historico para o botao do Android e o da tela andarem juntos. */
  back: () => void;
  /** Ligar ao `popstate` da janela. */
  onPopState: () => void;
}

/**
 * Sem biblioteca de rotas: quatro telas raiz e algumas empilhadas. Cada `push`
 * grava uma entrada no historico, e e o `popstate` que desempilha. Assim o
 * botao voltar do Android fecha a tela de cima em vez de sair do app.
 */
export function createRouter(history: HistoryLike, initial: Tab = "home"): Router {
  const tab = signal<Tab>(initial);
  const stack = signal<readonly Screen[]>([]);

  return {
    tab,
    stack,
    top: computed(() => stack.value.at(-1) ?? null),
    selectTab(next) {
      // Trocar de aba com telas abertas deixaria entradas orfas no historico.
      if (stack.value.length > 0) return;
      tab.value = next;
    },
    push(screen) {
      stack.value = [...stack.value, screen];
      history.pushState({ depth: stack.value.length }, "");
    },
    back() {
      if (stack.value.length === 0) return;
      history.back();
    },
    onPopState() {
      if (stack.value.length === 0) return;
      stack.value = stack.value.slice(0, -1);
    },
  };
}
