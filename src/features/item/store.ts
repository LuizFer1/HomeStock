import type { Ulid } from "../../domain/ids/ulid";
import type { Movement } from "../../domain/model/movement";
import type { Session } from "../session/session";

/**
 * Comandos de item para as telas: apagar, devolver e o stepper do Detalhe;
 * criar e salvar entram com o formulario.
 */
export interface ItemStore {
  remove: (id: Ulid) => Promise<void>;
  /** Movimentos ficam intactos ao apagar: devolve com a mesma quantidade. */
  restore: (id: Ulid) => Promise<void>;
  /** Fila serial: -1 grava useItem(id, 1), +1 grava restock(id, 1) sem preco. */
  step: (id: Ulid, direction: 1 | -1) => Promise<Movement>;
  /** Desfaz um toque do stepper apagando o movimento (e o preco, se houver). */
  undo: (movementId: Ulid) => Promise<void>;
}

export function createItemStore(session: Session): ItemStore {
  // Cada toque conta (nao ha guarda de duplo envio), mas um por vez: dois
  // toques seguidos nao podem gravar fora de ordem nem ler a mesma soma.
  let queue: Promise<unknown> = Promise.resolve();

  return {
    async remove(id) {
      await session.run((repo) => repo.deleteItem(id));
    },
    async restore(id) {
      await session.run((repo) => repo.restoreItem(id));
    },
    step(id, direction) {
      const next = queue.then(() =>
        session.run((repo) =>
          direction < 0 ? repo.useItem(id, 1) : repo.restock(id, 1).then((r) => r.movement),
        ),
      );
      // A falha volta para quem tocou; a fila segue para o proximo toque.
      queue = next.catch(() => {});
      return next;
    },
    async undo(movementId) {
      await session.run((repo) => repo.undoMovement(movementId));
    },
  };
}
