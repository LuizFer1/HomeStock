import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { type AppQrDeps, appUrl, bindAppQr } from "./app-qr";
import { loadLanding } from "./landing-html.fake";

function setup(over: Partial<AppQrDeps> = {}) {
  document.body.innerHTML = loadLanding().body.innerHTML;
  const qrSvg = vi.fn((p: string) => `<svg data-p="${p}"/>`);
  const loadQr = vi.fn(() => Promise.resolve({ qrSvg }));
  const deps: AppQrDeps = {
    platform: "desktop",
    standalone: false,
    url: "https://luizfer1.github.io/HomeStock/app/",
    loadQr,
    ...over,
  };
  bindAppQr(document, deps);
  return { loadQr, qrSvg };
}

const cards = () => [...document.querySelectorAll<HTMLElement>("[data-app-qr]")];
const imgs = () => [...document.querySelectorAll<HTMLImageElement>("[data-app-qr-img]")];
const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve();
};

describe("appUrl", () => {
  it("monta a URL absoluta do app a partir da base", () => {
    expect(appUrl("https://luizfer1.github.io/HomeStock/")).toBe(
      "https://luizfer1.github.io/HomeStock/app/",
    );
    expect(appUrl("http://localhost:4173/")).toBe("http://localhost:4173/app/");
  });
});

describe("cartao QR do app", () => {
  it("existe no hero e em #baixar, com a imagem oculta", () => {
    setup({ platform: "ios" });
    expect(cards()).toHaveLength(2);
    for (const img of imgs()) expect(img.hidden).toBe(true);
  });

  it("so a imagem do hero tem alt, com o destino; a de #baixar e decorativa", async () => {
    setup();
    await flush();
    const [hero, baixar] = imgs();
    expect(hero?.alt).toBe("QR code que abre luizfer1.github.io/HomeStock/app/ no celular");
    expect(baixar?.getAttribute("alt")).toBe("");
  });

  it("o CSS que mostra o cartao respeita [hidden]", () => {
    const css = readFileSync(resolve(import.meta.dirname, "landing.css"), "utf8");
    const rule = css.match(/html\[data-platform="desktop"\][^{]*\.app-qr[^{]*\{/);
    expect(rule?.[0]).toContain(":not([hidden])");
  });

  it("no computador carrega a lib, gera o QR da URL e mostra a imagem", async () => {
    const { loadQr, qrSvg } = setup();
    await flush();
    expect(loadQr).toHaveBeenCalledTimes(1);
    expect(qrSvg).toHaveBeenCalledWith("https://luizfer1.github.io/HomeStock/app/");
    for (const img of imgs()) {
      expect(img.hidden).toBe(false);
      expect(img.src).toMatch(/^data:image\/svg\+xml/);
    }
    for (const el of document.querySelectorAll("[data-app-qr-url]")) {
      expect(el.textContent).toBe("luizfer1.github.io/HomeStock/app/");
    }
  });

  it("em celular nao carrega a lib nem mostra a imagem", async () => {
    for (const platform of ["ios", "android"] as const) {
      const { loadQr } = setup({ platform });
      await flush();
      expect(loadQr).not.toHaveBeenCalled();
      for (const img of imgs()) expect(img.hidden).toBe(true);
    }
  });

  it("instalado como PWA nao carrega a lib", async () => {
    const { loadQr } = setup({ standalone: true });
    await flush();
    expect(loadQr).not.toHaveBeenCalled();
  });

  it("falha ao carregar esconde os cartoes sem quebrar", async () => {
    setup({ loadQr: () => Promise.reject(new Error("offline")) });
    await flush();
    for (const c of cards()) expect(c.hidden).toBe(true);
    for (const img of imgs()) expect(img.hidden).toBe(true);
  });
});
