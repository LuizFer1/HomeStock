import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { loadLanding } from "./landing-html.fake";
import { bindSimulation, type SimDeps } from "./sim-view";

/** IO falso: guarda o callback para o teste reportar a visibilidade. */
class FakeIO {
  static last: FakeIO | undefined;
  constructor(readonly cb: (entries: { isIntersecting: boolean }[]) => void) {
    FakeIO.last = this;
  }
  observe() {}
  unobserve() {}
  disconnect() {}
  report(isIntersecting: boolean) {
    this.cb([{ isIntersecting }]);
  }
}

function makeDeps(over: Partial<SimDeps> = {}): SimDeps {
  return {
    reduceMotion: false,
    setInterval: (fn, ms) => globalThis.setInterval(fn, ms) as unknown as number,
    clearInterval: (id) => globalThis.clearInterval(id),
    setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as number,
    clearTimeout: (id) => globalThis.clearTimeout(id),
    ...over,
  };
}

function mount(over: Partial<SimDeps> = {}) {
  const sim = loadLanding().querySelector("[data-sim]");
  if (!sim) throw new Error("[data-sim] ausente no index.html");
  document.body.innerHTML = sim.outerHTML;
  const root = document.querySelector<HTMLElement>("[data-sim]");
  if (!root) throw new Error("[data-sim] nao montou");
  return { root, handle: bindSimulation(root, document, makeDeps(over)) };
}

const text = (sel: string) => document.querySelector(sel)?.textContent?.replace(/\s/g, " ");
const value = () => text('[data-s="value"]');
const live = () => text("[data-sim-live]");
const tab = (name: string) => document.querySelector<HTMLElement>(`[data-sim-tab="${name}"]`);
const toggle = () => document.querySelector<HTMLElement>("[data-sim-toggle]");
const pill = () => document.querySelector("[data-sim-pill]");

describe("bindSimulation", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeIO.last = undefined;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("autoplay: o passo avanca a cada 2 s e a aba acompanha", () => {
    mount();
    expect(value()).toBe("R$ 1.284,50");
    vi.advanceTimersByTime(2000);
    expect(value()).toBe("R$ 1.249,60");
    expect(tab("home")?.getAttribute("aria-pressed")).toBe("true");
    expect(tab("scan")?.getAttribute("aria-pressed")).toBe("false");
    vi.advanceTimersByTime(4000);
    expect(tab("scan")?.getAttribute("aria-pressed")).toBe("true");
    expect(tab("home")?.getAttribute("aria-pressed")).toBe("false");
  });

  it("o avanco automatico nunca escreve na regiao viva", () => {
    mount();
    vi.advanceTimersByTime(10_000);
    expect(live()).toBe("");
  });

  it("tocar uma aba pausa, pula para o passo dela e avisa", () => {
    mount();
    tab("list")?.click();
    expect(text('[data-s="listDone"]')).toBe("0 de 5");
    expect(tab("list")?.getAttribute("aria-pressed")).toBe("true");
    expect(live()).toBe("Mostrando: Compras");
    vi.advanceTimersByTime(6000);
    expect(text('[data-s="listDone"]')).toBe("0 de 5");
    expect(toggle()?.getAttribute("aria-label")).toBe("Reproduzir simulação");
  });

  it("os nomes da regiao viva por aba", () => {
    mount();
    tab("scan")?.click();
    expect(live()).toBe("Mostrando: Escanear");
    tab("home")?.click();
    expect(live()).toBe("Mostrando: Início");
  });

  it("play/pause alterna rotulo, icone, regiao viva e relogio", () => {
    mount();
    const label = () => toggle()?.getAttribute("aria-label");
    const icons = () =>
      [...document.querySelectorAll("[data-sim-toggle] svg")].map((s) => s.hasAttribute("hidden"));
    expect(label()).toBe("Pausar simulação");
    expect(icons()).toEqual([false, true]);

    toggle()?.click();
    expect(label()).toBe("Reproduzir simulação");
    expect(live()).toBe("Simulação pausada");
    expect(icons()).toEqual([true, false]);
    vi.advanceTimersByTime(6000);
    expect(value()).toBe("R$ 1.284,50");

    toggle()?.click();
    expect(label()).toBe("Pausar simulação");
    expect(live()).toBe("Simulação em andamento");
    vi.advanceTimersByTime(2000);
    expect(value()).toBe("R$ 1.249,60");
  });

  it("movimento reduzido: comeca parada e o play faz andar", () => {
    mount({ reduceMotion: true });
    expect(toggle()?.getAttribute("aria-label")).toBe("Reproduzir simulação");
    vi.advanceTimersByTime(6000);
    expect(value()).toBe("R$ 1.284,50");
    toggle()?.click();
    vi.advanceTimersByTime(2000);
    expect(value()).toBe("R$ 1.249,60");
  });

  it("pop do aviso na troca de fase, por 260 ms", () => {
    mount();
    expect(pill()?.classList.contains("is-pop")).toBe(false);
    vi.advanceTimersByTime(2000);
    expect(text('[data-s="msgTitle"]')).toBe("Rafa usou o último sabão");
    expect(pill()?.classList.contains("is-pop")).toBe(true);
    vi.advanceTimersByTime(259);
    expect(pill()?.classList.contains("is-pop")).toBe(true);
    vi.advanceTimersByTime(1);
    expect(pill()?.classList.contains("is-pop")).toBe(false);
  });

  it("sem o celular na tela o relogio para e retoma de onde parou", () => {
    mount({ IntersectionObserver: FakeIO as unknown as typeof IntersectionObserver });
    const io = FakeIO.last;
    if (!io) throw new Error("IO nao foi criado");
    vi.advanceTimersByTime(2000);
    expect(value()).toBe("R$ 1.249,60");
    io.report(false);
    vi.advanceTimersByTime(10_000);
    expect(value()).toBe("R$ 1.249,60");
    io.report(true);
    vi.advanceTimersByTime(2000);
    expect(tab("home")?.getAttribute("aria-pressed")).toBe("true");
    expect(text('[data-s="msgTitle"]')).toBe("Rafa usou o último sabão");
    expect(tab("scan")?.getAttribute("aria-pressed")).toBe("false");
    vi.advanceTimersByTime(2000);
    expect(tab("scan")?.getAttribute("aria-pressed")).toBe("true");
  });

  it("aba do navegador escondida pausa o relogio", () => {
    mount();
    let state: DocumentVisibilityState = "hidden";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(10_000);
    expect(value()).toBe("R$ 1.284,50");
    state = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    vi.advanceTimersByTime(2000);
    expect(value()).toBe("R$ 1.249,60");
    Reflect.deleteProperty(document, "visibilityState");
  });

  it("stop limpa o intervalo", () => {
    const { handle } = mount();
    handle.stop();
    vi.advanceTimersByTime(10_000);
    expect(value()).toBe("R$ 1.284,50");
  });
});
