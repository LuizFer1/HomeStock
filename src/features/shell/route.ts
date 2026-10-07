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
  go: (delta: number) => void;
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
  /**
   * Volta ate a raiz de uma vez e resolve quando o navegador terminou. Usado
   * antes de recarregar: as entradas empilhadas sobreviveriam a recarga e o
   * primeiro voltar do Android seria engolido por uma entrada sem tela.
   */
  unwind: () => Promise<void>;
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
  let unwound: (() => void) | null = null;

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
    unwind() {
      const depth = stack.value.length;
      if (depth === 0) return Promise.resolve();
      return new Promise<void>((resolve) => {
        unwound = resolve;
        history.go(-depth);
        // Sem popstate (historico ja limpo pelo navegador) nao pode travar.
        setTimeout(resolve, 500);
      });
    },
    onPopState() {
      unwound?.();
      unwound = null;
      if (stack.value.length === 0) return;
      stack.value = stack.value.slice(0, -1);
    },
  };
}

/**
 * Volta so se a tela de cima ainda e a mesma de antes do `await`: o voltar do
 * sistema durante a gravacao ja desempilhou, e outro back sairia da tela de baixo.
 */
export function closeIfStill(router: Router, depth: number, kind: string): void {
  if (router.stack.value.length === depth && router.top.value?.kind === kind) router.back();
}
