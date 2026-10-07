import type { Ulid } from "../../domain/ids/ulid";
import type { Session } from "../session/session";

/**
 * Comandos de item para as telas. Nesta tarefa so apagar e devolver; criar,
 * salvar e o stepper do Detalhe entram nas proximas.
 */
export interface ItemStore {
  remove: (id: Ulid) => Promise<void>;
  /** Movimentos ficam intactos ao apagar: devolve com a mesma quantidade. */
  restore: (id: Ulid) => Promise<void>;
}

export function createItemStore(session: Session): ItemStore {
  return {
    async remove(id) {
      await session.run((repo) => repo.deleteItem(id));
    },
    async restore(id) {
      await session.run((repo) => repo.restoreItem(id));
    },
  };
}
