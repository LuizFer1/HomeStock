export interface ResetDeps {
  /** O `HomeStockDb` da aplicacao. So o `delete` importa aqui. */
  db: { delete: () => Promise<void> };
  /** `window.caches`, ausente onde o navegador nao o expoe. */
  caches?: { keys: () => Promise<string[]>; delete: (key: string) => Promise<boolean> };
  /** `navigator.serviceWorker`: limpa o registro gerado pelo Workbox no build. */
  serviceWorker?: { getRegistrations: () => Promise<readonly { unregister: () => unknown }[]> };
  reload: () => void;
}

/**
 * Acao mais destrutiva do app: a unica sem desfazer, porque o banco apagado nao
 * volta de lugar nenhum.
 *
 * Limpa as tres camadas que o navegador guarda. Apagar so o IndexedDB deixaria
 * o app carregando de um cache (service worker / Cache Storage) que espera
 * dados que nao existem mais.
 *
 * A recarga e o que garante que a sessao reabra de um banco vazio. Remendar os
 * signals em memoria para simular o estado inicial seria uma segunda
 * implementacao do boot, divergindo da primeira em silencio. Entra injetada,
 * senao o teste recarrega o runner.
 */
export async function resetDevice(deps: ResetDeps): Promise<void> {
  // Primeiro o que precisa dar certo. Se isto rejeitar, a funcao rejeita e a
  // pessoa ve o erro em vez de um app que diz ter apagado e nao apagou.
  await deps.db.delete();

  // Daqui para baixo e melhor esforco: um cache que nao limpa e um incomodo;
  // um banco que nao apaga seria a acao inteira falhando em silencio.
  try {
    const caches = deps.caches;
    if (caches !== undefined) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } catch {
    // Sem cache limpo, mas o dado ja foi.
  }

  try {
    if (deps.serviceWorker !== undefined) {
      const registrations = await deps.serviceWorker.getRegistrations();
      for (const registration of registrations) registration.unregister();
    }
  } catch {
    // Idem: o registro sobrevive, o dado nao.
  }

  deps.reload();
}
