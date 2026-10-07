import type { Ulid } from "../../domain/ids/ulid";
import type { MemberDraft } from "../../domain/model/member";
import type { PrefKey, PrefValues } from "../../domain/model/prefs";
import type { Session } from "../session/session";
import { buildStockCsv, stockCsvFilename } from "./stock-csv";

export interface SettingsStore {
  /** Edita o morador local. Lanca sem morador local. */
  saveProfile: (draft: MemberDraft) => Promise<void>;
  setPref: <K extends PrefKey>(key: K, value: PrefValues[K]) => Promise<void>;
  upsertCategory: (name: string, id?: Ulid) => Promise<void>;
  upsertLocation: (name: string, id?: Ulid) => Promise<void>;
  removeCategory: (id: Ulid) => Promise<void>;
  removeLocation: (id: Ulid) => Promise<void>;
  /** Monta o CSV do `session.data` atual e entrega ao `download` injetado. */
  exportStock: () => void;
}

export interface SettingsDeps {
  download: (filename: string, text: string) => void;
  /** 'YYYY-MM-DD' local, para o nome do arquivo. */
  today: () => string;
}

export function createSettingsStore(session: Session, deps: SettingsDeps): SettingsStore {
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
    async upsertCategory(name, id) {
      await session.run((repo) => repo.upsertCategory(name.trim(), id));
    },
    async upsertLocation(name, id) {
      await session.run((repo) => repo.upsertLocation(name.trim(), id));
    },
    async removeCategory(id) {
      await session.run((repo) => repo.removeCategory(id));
    },
    async removeLocation(id) {
      await session.run((repo) => repo.removeLocation(id));
    },
    exportStock() {
      deps.download(stockCsvFilename(deps.today()), buildStockCsv(session.data.value));
    },
  };
}
