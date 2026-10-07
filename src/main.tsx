import "./styles/app.css";
import { render } from "preact";
import { App } from "./app";
import type { AppContext } from "./app-context";
import { HomeStockDb } from "./data/db";
import { cryptoRandomChunk } from "./domain/ids/ulid";
import { createAlertsStore } from "./features/alerts/store";
import { createHomeStore } from "./features/home/store";
import { createItemStore } from "./features/item/store";
import { createOnboardingStore } from "./features/onboarding/store";
import { AVATAR_PHOTO, ITEM_PHOTO, processPhoto } from "./features/photo/photo";
import { browserPhotoDeps } from "./features/photo/photo-canvas";
import { createBrowserScannerEnv } from "./features/scanner/browser-env";
import { createSession } from "./features/session/session";
import { localToday } from "./features/session/today";
import { downloadText } from "./features/settings/download";
import { type ResetDeps, resetDevice } from "./features/settings/reset";
import { scopeResetDeps } from "./features/settings/reset-scope";
import { createSettingsStore } from "./features/settings/store";
import { createRouter } from "./features/shell/route";
import { createToastStore } from "./features/shell/toast";
import { createShoppingStore } from "./features/shopping/store";
import { createStockStore } from "./features/stock/store";
import { createUpdateStore, type SwContainer } from "./features/update/store";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Elemento #app nao encontrado em index.html");
}

// So referenciar `navigator.serviceWorker` ja lanca em contexto sandbox.
function serviceWorkerContainer(): SwContainer | undefined {
  try {
    return "serviceWorker" in navigator
      ? (navigator.serviceWorker as unknown as SwContainer)
      : undefined;
  } catch {
    return undefined;
  }
}

// Idem para `caches`: o getter lanca em contexto sandbox, e `typeof` nao protege.
function cachesOrUndefined(): ResetDeps["caches"] {
  try {
    return typeof caches === "undefined" ? undefined : caches;
  } catch {
    return undefined;
  }
}

const update = createUpdateStore({
  serviceWorker: serviceWorkerContainer(),
  reload: () => {
    window.location.reload();
  },
  now: () => Date.now(),
  version: __BUILD_TIME__,
});

// Uma instancia so: o reset precisa apagar esta, e uma segunda conexao aberta
// deixaria o `delete` do banco bloqueado.
const db = new HomeStockDb();

const session = createSession({
  db,
  now: () => Date.now(),
  randomChunk: cryptoRandomChunk,
  today: () => localToday(),
});
void session.init();

const onboarding = createOnboardingStore(session);
const settings = createSettingsStore(session, {
  download: downloadText,
  today: () => localToday(),
});

const router = createRouter(window.history);
window.addEventListener("popstate", router.onPopState);

// PWA instalado fica dias aberto sem navegar, e e na navegacao que o navegador
// procura `sw.js` novo. Voltar para o app e o momento natural de perguntar.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  void update.check();
  // Outra aba pode ter gravado enquanto esta estava escondida.
  if (session.status.value === "ready") void session.reload().catch(() => {});
});

const ctx: AppContext = {
  router,
  session,
  update,
  settings,
  toast: createToastStore(),
  items: createItemStore(session),
  stock: createStockStore(),
  shopping: createShoppingStore(session),
  alerts: createAlertsStore(session),
  home: createHomeStore(),
  today: () => localToday(),
  processAvatar: (file) => processPhoto(file, browserPhotoDeps, AVATAR_PHOTO),
  processItemPhoto: (file) => processPhoto(file, browserPhotoDeps, ITEM_PHOTO),
  // Leitor velho que sumiu do servidor: procurar a versao nova acende o aviso.
  scanner: createBrowserScannerEnv({ onStale: () => void update.check() }),
  onLeave: () =>
    resetDevice({
      db,
      // Mesma origem do HomeFinance: so o que e deste app (ver reset-scope.ts).
      ...scopeResetDeps({
        // Os dois helpers tem try/catch: em contexto sandbox so ler o getter lanca.
        caches: cachesOrUndefined(),
        serviceWorker: serviceWorkerContainer() as ResetDeps["serviceWorker"],
        scope: new URL(import.meta.env.BASE_URL, window.location.href).href,
      }),
      // Desempilha o historico antes: as entradas sobrevivem a recarga.
      reload: () => {
        void router.unwind().then(() => window.location.reload());
      },
    }),
};

render(<App ctx={ctx} onboarding={onboarding} />, root);
