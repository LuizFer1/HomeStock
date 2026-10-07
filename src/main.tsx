import "./styles/app.css";
import { render } from "preact";
import { App } from "./app";
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

const router = createRouter(window.history);
window.addEventListener("popstate", router.onPopState);

// PWA instalado fica dias aberto sem navegar, e e na navegacao que o navegador
// procura `sw.js` novo. Voltar para o app e o momento natural de perguntar.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") void update.check();
});

render(<App router={router} update={update} />, root);
