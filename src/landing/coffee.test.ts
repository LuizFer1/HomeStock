import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { bindCoffee, type CoffeeDeps } from "./coffee";
import { loadLanding } from "./landing-html.fake";

const PIX = { key: "cafe@homestock.app", name: "HomeStock", city: "SAO PAULO" };

function setup(over: Partial<CoffeeDeps> = {}) {
  document.body.innerHTML = loadLanding().body.innerHTML;
  const loadQr = vi.fn(() => Promise.resolve({ qrSvg: () => "<svg/>" }));
  const writeText = vi.fn(() => Promise.resolve());
  const deps: CoffeeDeps = {
    pix: PIX,
    wantsQr: () => false,
    loadQr,
    clipboard: { writeText },
    setTimeout: (fn, ms) => window.setTimeout(fn, ms),
    clearTimeout: (id) => window.clearTimeout(id),
    ...over,
  };
  bindCoffee(document, deps);
  return { loadQr, writeText };
}

const q = <T extends HTMLElement>(sel: string) => document.querySelector(sel) as T;
const dialog = () => document.getElementById("cafe-dialogo") as HTMLDialogElement;
const openers = () => [...document.querySelectorAll<HTMLElement>("[data-coffee-open]")];
const radio = (v: number) => q<HTMLInputElement>(`input[name="cafe-valor"][value="${v}"]`);
const text = (sel: string) => q(sel).textContent?.replace(/\s+/g, " ").trim();
const live = () => text("[data-coffee-live]");
const flush = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("abrir e fechar", () => {
  it("os dois botoes abrem e fechar devolve o foco", () => {
    setup();
    expect(openers()).toHaveLength(2);
    for (const opener of openers()) {
      opener.focus();
      opener.click();
      expect(dialog().hasAttribute("open")).toBe(true);
      q<HTMLElement>('#cafe-dialogo [aria-label="Fechar"]').click();
      expect(dialog().hasAttribute("open")).toBe(false);
      expect(document.activeElement).toBe(opener);
    }
  });
});

describe("valores", () => {
  it("padrao R$ 5 e troca para R$ 20", () => {
    setup();
    openers()[0]?.click();
    expect(text("[data-coffee-donate]")).toBe("Doar R$ 5,00");
    expect(text("[data-coffee-price]")).toBe("Pix · R$ 5,00");
    radio(20).checked = true;
    radio(20).dispatchEvent(new Event("change", { bubbles: true }));
    expect(text("[data-coffee-donate]")).toBe("Doar R$ 20,00");
    expect(text("[data-coffee-price]")).toBe("Pix · R$ 20,00");
    expect(q("[data-coffee-qr-img]").getAttribute("alt")).toBe("QR code Pix de R$ 20,00");
  });
});

describe("QR", () => {
  it("sem media query nunca carrega a lib", async () => {
    const { loadQr } = setup({ wantsQr: () => false });
    openers()[0]?.click();
    radio(10).checked = true;
    radio(10).dispatchEvent(new Event("change", { bubbles: true }));
    await flush();
    expect(loadQr).not.toHaveBeenCalled();
  });

  it("com media query gera ao abrir e guarda em cache por valor", async () => {
    const qrSvg = vi.fn((payload: string) => `<svg data-p="${payload.length}"/>`);
    const loadQr = vi.fn(() => Promise.resolve({ qrSvg }));
    setup({ wantsQr: () => true, loadQr });
    openers()[0]?.click();
    await flush();
    expect(loadQr).toHaveBeenCalled();
    expect(q<HTMLImageElement>("[data-coffee-qr-img]").getAttribute("src")).toMatch(
      /^data:image\/svg\+xml/,
    );
    const pick = async (v: number) => {
      radio(v).checked = true;
      radio(v).dispatchEvent(new Event("change", { bubbles: true }));
      await flush();
    };
    await pick(10);
    await pick(5);
    expect(qrSvg).toHaveBeenCalledTimes(2);
    expect(qrSvg.mock.calls.filter(([p]) => String(p).includes("54045.00"))).toHaveLength(1);
  });

  it("falha ao carregar esconde o bloco do QR", async () => {
    setup({ wantsQr: () => true, loadQr: () => Promise.reject(new Error("x")) });
    openers()[0]?.click();
    await flush();
    expect(q("[data-coffee-qr]").hasAttribute("hidden")).toBe(true);
  });
});

describe("copiar", () => {
  it("copia a chave, avisa e volta a Copiar em 1800 ms", async () => {
    const { writeText } = setup();
    openers()[0]?.click();
    q<HTMLElement>("[data-coffee-copy]").click();
    await flush();
    expect(writeText).toHaveBeenCalledWith("cafe@homestock.app");
    expect(text("[data-coffee-copy-label]")).toBe("Copiado");
    expect(live()).toBe("Chave Pix copiada");
    vi.advanceTimersByTime(1799);
    expect(text("[data-coffee-copy-label]")).toBe("Copiado");
    vi.advanceTimersByTime(1);
    expect(text("[data-coffee-copy-label]")).toBe("Copiar");
  });

  it("sem clipboard pede para copiar a mao", async () => {
    setup({ clipboard: undefined });
    openers()[0]?.click();
    q<HTMLElement>("[data-coffee-copy]").click();
    await flush();
    expect(text("[data-coffee-copy-label]")).toBe("Copie à mão");
    expect(live()).toBe("Não deu para copiar. A chave é cafe@homestock.app");
    vi.advanceTimersByTime(1800);
    expect(text("[data-coffee-copy-label]")).toBe("Copiar");
  });

  it("clipboard rejeitado tambem cai em Copie a mao", async () => {
    setup({ clipboard: { writeText: () => Promise.reject(new Error("no")) } });
    openers()[0]?.click();
    q<HTMLElement>("[data-coffee-copy]").click();
    await flush();
    expect(text("[data-coffee-copy-label]")).toBe("Copie à mão");
  });
});

describe("agradecimento", () => {
  it("R$ 10 mostra o texto no plural e foca o titulo", () => {
    setup();
    openers()[0]?.click();
    radio(10).checked = true;
    radio(10).dispatchEvent(new Event("change", { bubbles: true }));
    q<HTMLElement>("[data-coffee-donate]").click();
    expect(q("[data-coffee-view='ask']").hasAttribute("hidden")).toBe(true);
    expect(q("[data-coffee-view='thanks']").hasAttribute("hidden")).toBe(false);
    expect(text("[data-coffee-thanks-title]")).toBe("Valeu pelo café!");
    expect(text("[data-coffee-thanks-text]")).toBe(
      "Seus 2 cafés mantêm o HomeStock grátis para todas as casas.",
    );
    expect(document.activeElement).toBe(q("[data-coffee-thanks-title]"));
  });

  it("R$ 5 no singular, R$ 20 com 4 cafes", () => {
    setup();
    openers()[0]?.click();
    q<HTMLElement>("[data-coffee-donate]").click();
    expect(text("[data-coffee-thanks-text]")).toBe(
      "Seu café mantém o HomeStock grátis para todas as casas.",
    );
    q<HTMLElement>("[data-coffee-view='thanks'] [data-dialog-close]").click();
    openers()[0]?.click();
    radio(20).checked = true;
    radio(20).dispatchEvent(new Event("change", { bubbles: true }));
    q<HTMLElement>("[data-coffee-donate]").click();
    expect(text("[data-coffee-thanks-text]")).toContain("Seus 4 cafés mantêm");
  });

  it("Voltar ao site fecha e reabrir mostra o pedido com o mesmo valor", () => {
    setup();
    openers()[0]?.click();
    radio(10).checked = true;
    radio(10).dispatchEvent(new Event("change", { bubbles: true }));
    q<HTMLElement>("[data-coffee-donate]").click();
    q<HTMLElement>("[data-coffee-view='thanks'] [data-dialog-close]").click();
    expect(dialog().hasAttribute("open")).toBe(false);
    openers()[1]?.click();
    expect(q("[data-coffee-view='ask']").hasAttribute("hidden")).toBe(false);
    expect(q("[data-coffee-view='thanks']").hasAttribute("hidden")).toBe(true);
    expect(radio(10).checked).toBe(true);
    expect(text("[data-coffee-donate]")).toBe("Doar R$ 10,00");
  });
});
