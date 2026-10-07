// Liga a simulacao do hero ao DOM: aplica simFrame(step), corre o relogio, abas
// e play/pause. Toda decisao de conteudo fica em sim.ts; aqui so se escreve.
import {
  type HomeRow,
  type MsgKey,
  nextStep,
  POP_MS,
  type SimFrame,
  type SimScreen,
  STEP_MS,
  simFrame,
  TAB_START,
} from "./sim";

export interface SimDeps {
  reduceMotion: boolean;
  setInterval: (fn: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
  /** Ausente: considera o celular sempre na tela. */
  IntersectionObserver?: typeof IntersectionObserver;
}

const TAB_NAMES: Record<SimScreen, string> = {
  home: "Início",
  scan: "Escanear",
  list: "Compras",
};

/** Escreve `text` em todo elemento [data-s="campo"] (o valor aparece em dois lugares). */
function setText(root: ParentNode, field: string, text: string): void {
  for (const el of root.querySelectorAll(`[data-s="${field}"]`)) {
    if (el.textContent !== text) el.textContent = text;
  }
}

function renderRow(el: Element, row: HomeRow): void {
  const blob = el.querySelector('[data-r="letter"]');
  if (blob) {
    blob.textContent = row.letter;
    blob.setAttribute("data-tone", row.tone);
  }
  const name = el.querySelector('[data-r="name"]');
  if (name) name.textContent = row.name;
  const note = el.querySelector('[data-r="note"]');
  if (note) note.textContent = row.note;
  const qty = el.querySelector('[data-r="qty"]');
  if (qty) qty.textContent = row.qty;
  el.setAttribute("data-highlight", row.highlight);
}

/** Aplica o quadro inteiro. Idempotente: pode rodar a cada passo. */
function render(root: HTMLElement, f: SimFrame): void {
  for (const screen of root.querySelectorAll("[data-sim-screen]")) {
    screen.classList.toggle("is-active", screen.getAttribute("data-sim-screen") === f.screen);
  }
  for (const tab of root.querySelectorAll("[data-sim-tab]")) {
    const on = tab.getAttribute("data-sim-tab") === f.screen;
    tab.setAttribute("aria-pressed", on ? "true" : "false");
  }

  setText(root, "pct", `${f.pct}%`);
  setText(root, "value", f.value);
  setText(root, "acabando", String(f.acabando));
  setText(root, "naLista", String(f.naLista));
  setText(root, "listDone", f.listDone);
  setText(root, "listLeft", f.listLeft);
  setText(root, "msgTitle", f.msgTitle);
  setText(root, "msgSub", f.msgSub);

  root.querySelectorAll("[data-sim-row]").forEach((el, i) => {
    const row = f.rows[i];
    if (row) renderRow(el, row);
  });
  // style e nao atributo: e a propriedade CSS que a transicao anima.
  root
    .querySelector<SVGElement>("[data-sim-ring]")
    ?.style.setProperty("stroke-dasharray", f.ringDash);
  root.querySelector("[data-sim-fab]")?.classList.toggle("is-pulse", f.fabPulse);
  root.querySelector("[data-sim-found]")?.classList.toggle("is-on", f.scanFound);
  root.querySelector("[data-sim-save]")?.classList.toggle("is-pressed", f.savePressed);
  const bar = root.querySelector<HTMLElement>("[data-sim-bar]");
  if (bar) bar.style.width = f.listWidth;
  root.querySelectorAll("[data-sim-item]").forEach((el, i) => {
    el.classList.toggle("is-done", i < f.checked);
  });
  root.querySelector("[data-sim-pill]")?.setAttribute("data-msg", f.msg);
}

export function bindSimulation(root: HTMLElement, doc: Document, deps: SimDeps): { stop(): void } {
  const live = root.querySelector("[data-sim-live]");
  const toggle = root.querySelector("[data-sim-toggle]");
  const pill = root.querySelector("[data-sim-pill]");

  let step = 0;
  let playing = !deps.reduceMotion;
  let visible = true;
  let tabVisible = doc.visibilityState !== "hidden";
  let intervalId: number | null = null;
  let popId: number | null = null;
  let lastMsg: MsgKey = simFrame(0).msg;

  const say = (text: string) => {
    if (live) live.textContent = text;
  };

  /** O intervalo so existe com tudo a favor; ao voltar continua do mesmo passo. */
  function syncClock(): void {
    const shouldRun = playing && visible && tabVisible;
    if (shouldRun && intervalId === null) {
      intervalId = deps.setInterval(() => go(nextStep(step)), STEP_MS);
    } else if (!shouldRun && intervalId !== null) {
      deps.clearInterval(intervalId);
      intervalId = null;
    }
  }

  function pop(): void {
    if (popId !== null) deps.clearTimeout(popId);
    pill?.classList.add("is-pop");
    popId = deps.setTimeout(() => {
      pill?.classList.remove("is-pop");
      popId = null;
    }, POP_MS);
  }

  function go(next: number): void {
    step = next;
    const frame = simFrame(step);
    render(root, frame);
    if (frame.msg !== lastMsg) {
      lastMsg = frame.msg;
      pop();
    }
  }

  function renderToggle(): void {
    if (!toggle) return;
    const label = playing ? "Pausar simulação" : "Reproduzir simulação";
    toggle.setAttribute("aria-label", label);
    toggle.setAttribute("title", label);
    const [pauseIcon, playIcon] = toggle.querySelectorAll("svg");
    pauseIcon?.toggleAttribute("hidden", !playing);
    playIcon?.toggleAttribute("hidden", playing);
  }

  const onTab = (e: Event) => {
    const tab = e.currentTarget as Element;
    const name = tab.getAttribute("data-sim-tab") as SimScreen | null;
    if (!name || !(name in TAB_START)) return;
    playing = false;
    go(TAB_START[name]);
    renderToggle();
    syncClock();
    say(`Mostrando: ${TAB_NAMES[name]}`);
  };
  const onToggle = () => {
    playing = !playing;
    renderToggle();
    syncClock();
    say(playing ? "Simulação em andamento" : "Simulação pausada");
  };
  const onVisibility = () => {
    tabVisible = doc.visibilityState !== "hidden";
    syncClock();
  };

  const tabs = [...root.querySelectorAll("[data-sim-tab]")];
  for (const tab of tabs) tab.addEventListener("click", onTab);
  toggle?.addEventListener("click", onToggle);
  doc.addEventListener("visibilitychange", onVisibility);

  let observer: IntersectionObserver | undefined;
  if (deps.IntersectionObserver) {
    observer = new deps.IntersectionObserver((entries) => {
      const last = entries[entries.length - 1];
      if (!last) return;
      visible = last.isIntersecting;
      syncClock();
    });
    observer.observe(root);
  }

  // O HTML ja traz o passo 0, mas o rotulo do play depende do movimento reduzido.
  render(root, simFrame(0));
  renderToggle();
  syncClock();

  return {
    stop() {
      if (intervalId !== null) deps.clearInterval(intervalId);
      intervalId = null;
      if (popId !== null) deps.clearTimeout(popId);
      popId = null;
      observer?.disconnect();
      doc.removeEventListener("visibilitychange", onVisibility);
      toggle?.removeEventListener("click", onToggle);
      for (const tab of tabs) tab.removeEventListener("click", onTab);
    },
  };
}
