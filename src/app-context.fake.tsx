import { signal } from "@preact/signals";
import { type Mock, vi } from "vitest";
import type { Session } from "./features/session/session";
import { createSettingsStore } from "./features/settings/store";
import { createRouter } from "./features/shell/route";
import type { UpdateStore } from "./features/update/store";
import type { AppContext } from "./screens";

/** Aviso de versao parado: `ready` diz se ja ha versao nova esperando. */
export function fakeUpdate(ready = false): UpdateStore {
  return {
    ready: signal(ready),
    check: async () => "current",
    apply: () => {},
    version: null,
  };
}

/** Contexto completo para testes de tela, com historico falso e stores reais sobre a sessao. */
export function testContext(
  session: Session,
  overrides: Partial<AppContext> = {},
): { ctx: AppContext; history: { pushState: Mock; back: Mock; go: Mock } } {
  // O `back` falso dispara o popstate na hora para a pilha andar como no navegador.
  const history = {
    pushState: vi.fn(),
    back: vi.fn(() => router.onPopState()),
    go: vi.fn(),
  };
  const router = createRouter(history);
  const ctx: AppContext = {
    router,
    session,
    update: fakeUpdate(),
    settings: createSettingsStore(session, { download: vi.fn(), today: () => "2026-10-06" }),
    processAvatar: async () => "data:image/webp;base64,AAA",
    onLeave: async () => {},
    ...overrides,
  };
  return { ctx, history };
}
