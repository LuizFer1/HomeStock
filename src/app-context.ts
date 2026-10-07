import type { ItemStore } from "./features/item/store";
import type { Session } from "./features/session/session";
import type { SettingsStore } from "./features/settings/store";
import type { Router } from "./features/shell/route";
import type { ToastStore } from "./features/shell/toast";
import type { StockStore } from "./features/stock/store";
import type { UpdateStore } from "./features/update/store";

/** Tudo que as telas recebem, montado uma vez no `main.tsx`. */
export interface AppContext {
  router: Router;
  session: Session;
  update: UpdateStore;
  settings: SettingsStore;
  /** Um toast por vez, renderizado pelo App acima de abas e telas empilhadas. */
  toast: ToastStore;
  items: ItemStore;
  /** Busca, filtro e rolagem do Estoque, vivos entre idas ao Detalhe. */
  stock: StockStore;
  /** 'YYYY-MM-DD' local, para status e notas de validade. */
  today: () => string;
  /** Pipeline da foto de perfil (o antigo `processFile`). */
  processAvatar: (file: Blob) => Promise<string>;
  /** Pipeline da foto de item (ITEM_PHOTO). */
  processItemPhoto: (file: Blob) => Promise<string>;
  onLeave: () => Promise<void>;
}
