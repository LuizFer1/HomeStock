import { type Signal, signal } from "@preact/signals";
import type { FilterKey } from "./rows";

/**
 * Estado da lista fora do componente: o App desmonta a aba ao empilhar uma
 * tela, e voltar do Detalhe perderia a busca, o filtro e a posicao.
 */
export interface StockStore {
  query: Signal<string>;
  filter: Signal<FilterKey>;
  /** `window.scrollY` guardado ao sair para uma tela empilhada. */
  scrollY: Signal<number>;
}

export function createStockStore(): StockStore {
  return {
    query: signal(""),
    filter: signal<FilterKey>("all"),
    scrollY: signal(0),
  };
}
