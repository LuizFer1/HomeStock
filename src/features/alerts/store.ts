import { type Signal, signal } from "@preact/signals";
import type { Session } from "../session/session";

/** Comandos dos alertas para as telas: so o resolvido e gravado. */
export interface AlertsStore {
  /**
   * Fila serial: grava `resolveAlerts` e republica. Devolve as chaves que ESTA
   * chamada gravou (o conjunto de desfazer): chave que ja estava resolvida,
   * talvez por outro morador, fica de fora e o desfazer nao a reabre.
   */
  resolve: (keys: readonly string[]) => Promise<string[]>;
  /** Mesma fila: `reopenAlerts` (desfazer). */
  reopen: (keys: readonly string[]) => Promise<void>;
  /** Cartao que abriu o Detalhe ("Ver item"); a tela foca ao voltar e zera. */
  returnFocus: Signal<string | null>;
  /** Erro por cartao (chave do alerta). Vive aqui porque "Ver item" desmonta a tela. */
  errors: Signal<Record<string, string>>;
}

export function createAlertsStore(session: Session): AlertsStore {
  // Resolver e desfazer seguidos nao podem gravar fora de ordem.
  let queue: Promise<unknown> = Promise.resolve();
  function enqueue<T>(work: () => Promise<T>): Promise<T> {
    const next = queue.then(work);
    // A falha volta para quem chamou; a fila segue.
    queue = next.catch(() => {});
    return next;
  }

  return {
    resolve(keys) {
      return enqueue(async () => {
        const written = await session.run((repo) => repo.resolveAlerts(keys));
        return written.map((row) => row.key);
      });
    },
    async reopen(keys) {
      await enqueue(() => session.run((repo) => repo.reopenAlerts(keys)));
    },
    returnFocus: signal<string | null>(null),
    errors: signal<Record<string, string>>({}),
  };
}
