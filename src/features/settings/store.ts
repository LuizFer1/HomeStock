import type { MemberDraft } from "../../domain/model/member";
import type { PrefKey, PrefValues } from "../../domain/model/prefs";
import type { Session } from "../session/session";

export interface SettingsStore {
  /** Edita o morador local. Lanca sem morador local. */
  saveProfile: (draft: MemberDraft) => Promise<void>;
  setPref: <K extends PrefKey>(key: K, value: PrefValues[K]) => Promise<void>;
}

export function createSettingsStore(session: Session): SettingsStore {
  return {
    async saveProfile(draft) {
      await session.run(async (repo) => {
        // O id vem da hora do comando: o aparelho pode ter perdido o morador entre telas.
        const id = await repo.localMemberId();
        if (id === null) throw new Error("Nenhum morador neste aparelho");
        await repo.updateMember(id, draft);
      });
    },
    async setPref(key, value) {
      await session.run(async (repo) => {
        await repo.setPref(key, value);
      });
    },
  };
}
