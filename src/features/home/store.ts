import { type Signal, signal } from "@preact/signals";

/** O Inicio desmonta ao empilhar uma tela; o controle que a abriu volta a ter o foco. */
export interface HomeStore {
  /** "settings", "alerts", "counter-expiring" ou "item:<id>". */
  returnFocus: Signal<string | null>;
}

export function createHomeStore(): HomeStore {
  return { returnFocus: signal<string | null>(null) };
}
