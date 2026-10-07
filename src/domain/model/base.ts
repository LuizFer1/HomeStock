import type { Ulid } from "../ids/ulid";

/**
 * Colunas que toda tabela tem. Sao elas que o sync com o HubStock vai usar:
 * `updatedAt` decide o LWW por linha, `deletedAt` propaga a exclusao e `dirty`
 * (indexado) diz o que ainda nao foi enviado.
 *
 * `dirty` e `0 | 1` e nao boolean porque o IndexedDB nao indexa boolean.
 */
export interface BaseRow {
  id: Ulid;
  /** ISO 8601 do aparelho. So para leitura humana; nunca decide conflito. */
  createdAt: string;
  /** HLC. Um relogio de parede adiantado nao pode vencer todo conflito. */
  updatedAt: string;
  /** HLC da exclusao, ou null. A linha nunca sai da tabela. */
  deletedAt: string | null;
  dirty: 0 | 1;
  /** Morador que escreveu a linha; null so nas sementes. */
  authorId: Ulid | null;
}

export type Draft<T extends BaseRow> = Omit<T, keyof BaseRow>;

export function isAlive<T extends BaseRow>(row: T | undefined): row is T {
  return row !== undefined && row.deletedAt === null;
}
