import { computed, type ReadonlySignal } from "@preact/signals";
import type { MemberDraft } from "../../domain/model/member";
import type { Session } from "../session/session";

export interface OnboardingStore {
  /** `ready` e sem `localMemberId`. Nunca "nao existe morador na tabela": o sync traz os outros. */
  needsOnboarding: ReadonlySignal<boolean>;
  complete: (draft: MemberDraft) => Promise<void>;
}

/**
 * Primeiro uso e `localMemberId` vazio, nao "nao existe morador na tabela":
 * depois do sync os outros moradores estarao la. O `ready` evita o wizard
 * piscar antes de o disco responder.
 */
export function createOnboardingStore(session: Session): OnboardingStore {
  // Promise em voo: um duplo toque no CTA dispara duas chamadas antes de
  // `localMemberId` ser publicado (so acontece depois do await), e checar o
  // signal sozinho nao pega isso. Guardando a promise, a segunda chamada
  // devolve a mesma gravacao em vez de criar um segundo morador.
  let inFlight: Promise<void> | null = null;

  async function complete(draft: MemberDraft): Promise<void> {
    if (session.localMemberId.value !== null) return;
    if (inFlight !== null) return inFlight;
    // Limpa sempre, sucesso ou falha: em falha, uma nova tentativa precisa rodar.
    inFlight = session
      .run(async (repo) => {
        await repo.createLocalMember(draft);
      })
      .finally(() => {
        inFlight = null;
      });
    return inFlight;
  }

  return {
    needsOnboarding: computed(
      () => session.status.value === "ready" && session.localMemberId.value === null,
    ),
    complete,
  };
}
