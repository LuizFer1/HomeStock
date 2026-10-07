// Pagina de vitrine: HTML estatico, CSS a mao, TS sem framework. Cada parte se
// liga aqui; o first paint e o proprio HTML.
import "./landing.css";
import { startFloat, startReveal } from "./motion";
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
