// Pagina de vitrine: HTML estatico, CSS a mao, TS sem framework. Cada parte se
// liga aqui; o first paint e o proprio HTML.
import "./landing.css";
import { bindCoffee } from "./coffee";
import { createInstallFlow } from "./install";
import { bindInstall } from "./install-view";
import { startFloat, startReveal } from "./motion";
import { PIX } from "./pix-config";
import { detectPlatform } from "./platform";
import { bindSharedList } from "./shared-list";
import { bindSimulation } from "./sim-view";

bindSharedList(document);

/** Lido uma vez: as outras partes (simulacao) usam o mesmo valor. */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Mesma condicao do script do <head> que liga a classe `motion`.
if (!reduceMotion) {
  startFloat(document, {
    request: (cb) => requestAnimationFrame(cb),
    cancel: (id) => cancelAnimationFrame(id),
  });
  if ("IntersectionObserver" in window) startReveal(document, IntersectionObserver);
}

const sim = document.querySelector<HTMLElement>("[data-sim]");
if (sim) {
  bindSimulation(sim, document, {
    reduceMotion,
    setInterval: (fn, ms) => window.setInterval(fn, ms),
    clearInterval: (id) => window.clearInterval(id),
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    IntersectionObserver: "IntersectionObserver" in window ? IntersectionObserver : undefined,
  });
}

bindInstall(document, {
  platform: detectPlatform({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints,
    coarse: window.matchMedia("(pointer: coarse)").matches,
  }),
  flow: createInstallFlow(),
  standalone: window.matchMedia("(display-mode: standalone)").matches,
  win: window,
});

bindCoffee(document, {
  pix: PIX,
  wantsQr: () =>
    window.matchMedia("(hover: hover) and (pointer: fine) and (min-width: 720px)").matches,
  // Import dinamico: a lib do QR vira o chunk landing-qr-*.js, baixado so ao abrir no computador.
  loadQr: () => import("./landing-qr"),
  clipboard: navigator.clipboard,
  setTimeout: (fn, ms) => window.setTimeout(fn, ms),
  clearTimeout: (id) => window.clearTimeout(id),
});
