import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLanding } from "./landing-html.fake";

const REPO = "https://github.com/LuizFer1/HomeStock";

describe("index.html da landing", () => {
  const doc = loadLanding();

  it("pt-BR, titulo e descricao", () => {
    expect(doc.documentElement.getAttribute("lang")).toBe("pt-BR");
    expect(doc.title).toBe("HomeStock: sua casa avisa antes de acabar");
    expect(doc.querySelector('meta[name="description"]')?.getAttribute("content")).toMatch(
      /offline/,
    );
  });

  it("pula para o conteudo", () => {
    expect(doc.querySelector("a.skip")?.getAttribute("href")).toBe("#conteudo");
    expect(doc.querySelector("main#conteudo")).not.toBeNull();
  });

  it("carrega so o script da landing", () => {
    const scripts = [...doc.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
    expect(scripts).toEqual(["/src/landing/main.ts"]);
  });

  it("nada de rede externa: so links para o repositorio", () => {
    for (const el of doc.querySelectorAll("[src], [href]")) {
      const url = el.getAttribute("src") ?? el.getAttribute("href") ?? "";
      if (/^https?:/.test(url)) expect(url.startsWith(REPO), url).toBe(true);
    }
  });

  it("o CSS nao busca nada fora", () => {
    const css = readFileSync(resolve(import.meta.dirname, "landing.css"), "utf8");
    expect(css).not.toMatch(/https?:\/\//);
    expect(css).not.toMatch(/@import\s+url\(/);
  });
});
