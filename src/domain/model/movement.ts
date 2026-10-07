import type { Ulid } from "../ids/ulid";
import type { BaseRow } from "./base";

export type MovementReason = "initial" | "use" | "restock" | "adjust";

/**
 * Entrada ou saida de estoque. So de insercao: depois de criada, a linha so
 * muda para receber `deletedAt` (desfazer). A quantidade de um item e a soma
 * dos `delta` vivos dele; dois celulares que tiram uma unidade cada, offline,
 * somam -2 depois do sync.
 */
export interface Movement extends BaseRow {
  itemId: Ulid;
  /** Inteiro, nunca 0. */
  delta: number;
  reason: MovementReason;
}

/**
 * Preco pago numa reposicao. So de insercao, como `Movement`. E o historico
 * que a futura feature "sua inflacao" vai ler.
 */
export interface Price extends BaseRow {
  itemId: Ulid;
  unitPriceMinor: number;
  qty: number;
  /** 'YYYY-MM-DD' da compra. */
  on: string;
  /** O restock que trouxe este preco; desfazer o movimento apaga o preco junto. */
  movementId: Ulid;
}
