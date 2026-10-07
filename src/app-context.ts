import type { Session } from "./features/session/session";
import type { SettingsStore } from "./features/settings/store";
import type { Router } from "./features/shell/route";
import type { UpdateStore } from "./features/update/store";

/** Tudo que as telas recebem, montado uma vez no `main.tsx`. */
export interface AppContext {
  router: Router;
  session: Session;
  update: UpdateStore;
  settings: SettingsStore;
  /** Pipeline da foto de perfil (o antigo `processFile`). */
  processAvatar: (file: Blob) => Promise<string>;
  onLeave: () => Promise<void>;
}
