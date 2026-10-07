import "./styles/app.css";
import { render } from "preact";
import { App } from "./app";
import { HomeStockDb } from "./data/db";
import { cryptoRandomChunk } from "./domain/ids/ulid";
import { createOnboardingStore } from "./features/onboarding/store";
import { AVATAR_PHOTO, processPhoto } from "./features/photo/photo";
import { browserPhotoDeps } from "./features/photo/photo-canvas";
import { createSession } from "./features/session/session";
import { localToday } from "./features/session/today";
import { createSettingsStore } from "./features/settings/store";
import { createRouter } from "./features/shell/route";
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
const settings = createSettingsStore(session);

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

render(
  <App
    router={router}
    update={update}
    session={session}
    onboarding={onboarding}
    settings={settings}
    processFile={(file) => processPhoto(file, browserPhotoDeps, AVATAR_PHOTO)}
  />,
  root,
);
