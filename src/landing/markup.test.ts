import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { loadLanding, textOf } from "./landing-html.fake";

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

describe("acessibilidade do markup", () => {
  const doc = loadLanding();

  it("todo botao declara type=button", () => {
    for (const b of doc.querySelectorAll("button")) {
      expect(b.getAttribute("type"), b.outerHTML.slice(0, 80)).toBe("button");
    }
  });

  it("todo svg e decorativo", () => {
    for (const svg of doc.querySelectorAll("svg")) {
      expect(svg.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("ids unicos", () => {
    const ids = [...doc.querySelectorAll("[id]")].map((el) => el.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("toda secao rotulada aponta para um titulo que existe", () => {
    for (const s of doc.querySelectorAll("section[aria-labelledby]")) {
      const id = s.getAttribute("aria-labelledby") ?? "";
      expect(doc.getElementById(id), id).not.toBeNull();
    }
  });
});

describe("nav", () => {
  const doc = loadLanding();

  it("a marca leva ao topo e os links levam as secoes", () => {
    expect(doc.querySelector("header.top a.brand")?.getAttribute("href")).toBe("#topo");
    const links = [...doc.querySelectorAll('header.top nav[aria-label="Seções"] a')].map((a) => [
      textOf(a),
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Como funciona", "#como"],
      ["Para dividir", "#casa"],
    ]);
  });

  it("o cafe tem nome mesmo so com icone e o CTA vai para Baixar", () => {
    const coffee = doc.querySelector("header.top button[data-coffee-open]");
    expect(coffee?.getAttribute("aria-label")).toBe("Doe um café");
    const cta = doc.querySelector("header.top a.top-cta");
    expect(cta?.getAttribute("href")).toBe("#baixar");
    expect(textOf(cta?.querySelector(".cta-long"))).toBe("Comece grátis");
    expect(textOf(cta?.querySelector(".cta-short"))).toBe("Começar");
  });
});

describe("hero", () => {
  const doc = loadLanding();
  const hero = doc.querySelector("section#topo");

  it("um H1 so, com as duas linhas", () => {
    const h1s = doc.querySelectorAll("h1");
    expect(h1s).toHaveLength(1);
    expect(textOf(h1s[0])).toBe("Sua casa avisa antes de acabar.");
    expect(hero?.getAttribute("aria-labelledby")).toBe("topo-titulo");
  });

  it("CTAs de instalacao, do navegador e do app", () => {
    expect(textOf(hero?.querySelector('button[data-install="ios"]'))).toBe("Instalar no iPhone");
    expect(textOf(hero?.querySelector('button[data-install="android"]'))).toBe(
      "Instalar no Android",
    );
    const browser = hero?.querySelector("a[data-browser]");
    expect(textOf(browser)).toBe("Usar no navegador");
    expect(browser?.getAttribute("href")).toBe("app/");
    const open = hero?.querySelector("a[data-open-app]");
    expect(textOf(open)).toBe("Abrir o app");
    expect(open?.getAttribute("href")).toBe("app/");
    expect(textOf(hero?.querySelector(".cta-note"))).toBe("Grátis para a casa toda · sem cartão");
  });
});

describe("simulacao do hero", () => {
  const doc = loadLanding();
  const sim = doc.querySelector("#topo [data-sim]");

  it("existe no hero, com a descricao para leitor de tela", () => {
    expect(sim).not.toBeNull();
    expect(textOf(doc.querySelector("#topo p.sr-only"))).toBe(
      "Simulação do app: o Início mostra o que está acabando, o leitor de código de barras guarda um café e a lista de compras vai sendo marcada no mercado.",
    );
  });

  it("celular e avisos sao decorativos e nada dentro deles recebe foco", () => {
    const decor = sim?.querySelectorAll(".sim-phone, .sim-float") ?? [];
    expect(decor.length).toBeGreaterThanOrEqual(3);
    for (const el of decor) {
      expect(el.getAttribute("aria-hidden"), el.className).toBe("true");
      expect(el.querySelectorAll("a, button, input, [tabindex]")).toHaveLength(0);
    }
  });

  it("controles: tres abas e o play/pause com nome", () => {
    const group = sim?.querySelector('[role="group"]');
    expect(group?.getAttribute("aria-label")).toBe("Controles da simulação");
    const tabs = [...(group?.querySelectorAll("button[data-sim-tab]") ?? [])];
    expect(tabs.map((t) => textOf(t))).toEqual(["Início", "Escanear", "Compras"]);
    expect(tabs.map((t) => t.getAttribute("data-sim-tab"))).toEqual(["home", "scan", "list"]);
    for (const t of tabs) expect(t.hasAttribute("aria-pressed")).toBe(true);
    expect(group?.querySelector("button[data-sim-toggle]")?.getAttribute("aria-label")).toBe(
      "Pausar simulação",
    );
  });

  it("regiao viva educada, so para o que a pessoa pedir", () => {
    const live = sim?.querySelector("[data-sim-live]");
    expect(live?.getAttribute("aria-live")).toBe("polite");
    expect(live?.classList.contains("sr-only")).toBe(true);
    expect(textOf(live)).toBe("");
  });

  it("ja mostra o quadro do passo 0 sem JS", () => {
    expect(textOf(sim?.querySelector('[data-s="value"]'))?.replace(/\s/g, " ")).toBe("R$ 1.284,50");
    expect(textOf(sim?.querySelector('[data-s="msgTitle"]'))).toBe("Leite vence em 3 dias");
    expect(textOf(sim?.querySelector(".sim-legend"))).toBe(
      "Simulação ao vivo · toque para explorar",
    );
  });
});

describe("numeros", () => {
  const doc = loadLanding();

  it("quatro circulos com valor e legenda", () => {
    const section = doc.querySelector('section[aria-label="HomeStock em números"]');
    const stats = [...(section?.querySelectorAll(".stat") ?? [])].map((s) => [
      textOf(s.querySelector(".stat-value")),
      textOf(s.querySelector(".stat-label")),
    ]);
    expect(stats).toEqual([
      ["1 toque", "para cadastrar pelo código de barras"],
      ["3 dias", "de aviso antes de vencer"],
      ["0 listas", "escritas à mão na porta da geladeira"],
      ["0 contas", "sem e-mail e sem senha para começar"],
    ]);
  });
});

describe("como funciona", () => {
  const doc = loadLanding();

  it("titulo e tres cards", () => {
    const section = doc.querySelector("section#como");
    expect(textOf(doc.getElementById("como-titulo"))).toBe("Do mercado ao armário, sem planilha.");
    const titles = [...(section?.querySelectorAll(".feature h3") ?? [])].map((h) => textOf(h));
    expect(titles).toEqual([
      "Escaneou, guardou",
      "Aviso antes de acabar",
      "Lista que se escreve sozinha",
    ]);
  });
});

describe("para dividir", () => {
  const doc = loadLanding();
  const casa = doc.querySelector("section#casa");

  it("titulo, tags e dica", () => {
    expect(casa?.getAttribute("aria-labelledby")).toBe("casa-titulo");
    expect(textOf(doc.getElementById("casa-titulo"))).toBe(
      "Cada um com sua cor, todo mundo na mesma lista.",
    );
    const tags = [...(casa?.querySelectorAll(".casa-tags .tag") ?? [])].map((t) => textOf(t));
    expect(tags).toEqual(["Casais", "Repúblicas", "Famílias"]);
  });

  it("cinco itens que sao botoes de alternar", () => {
    const names = [...(casa?.querySelectorAll("button[data-list-item] .shop-name") ?? [])].map(
      (n) => textOf(n),
    );
    expect(names).toEqual([
      "Sabão em pó 1,6 kg",
      "Café em grãos 1 kg",
      "Leite integral 1 L",
      "Banana prata",
      "Esponja de louça",
    ]);
  });
});

describe("baixar", () => {
  const doc = loadLanding();
  const baixar = doc.querySelector("section#baixar");

  it("titulo e os mesmos CTAs do hero", () => {
    expect(textOf(doc.getElementById("baixar-titulo"))).toBe(
      "Comece pela despensa. O resto vem junto.",
    );
    expect(baixar?.querySelector('.cta-col button[data-install="ios"]')).not.toBeNull();
    expect(baixar?.querySelector('.cta-col button[data-install="android"]')).not.toBeNull();
    expect(baixar?.querySelector(".cta-col a[data-browser]")?.getAttribute("href")).toBe("app/");
    expect(baixar?.querySelector(".cta-col a[data-open-app]")?.getAttribute("href")).toBe("app/");
  });
});

describe("faixa do cafe", () => {
  const doc = loadLanding();

  it("titulo e botao que abre o dialogo", () => {
    expect(textOf(doc.getElementById("cafe-titulo"))).toBe("O HomeStock é gratuito.");
    expect(textOf(doc.querySelector("section.cafe button[data-coffee-open]"))).toBe("Doe um café");
  });
});

describe("rodape", () => {
  const doc = loadLanding();

  it("links reais, sem ancora morta", () => {
    const links = [...doc.querySelectorAll('footer nav[aria-label="Rodapé"] a')].map((a) => [
      textOf(a),
      a.getAttribute("href"),
    ]);
    expect(links).toEqual([
      ["Como funciona", "#como"],
      ["Privacidade", "#privacidade"],
      ["Contato", "https://github.com/LuizFer1/HomeStock/issues"],
      ["GitHub", "https://github.com/LuizFer1/HomeStock"],
    ]);
    for (const [, href] of links) {
      if (href?.startsWith("#")) expect(doc.getElementById(href.slice(1)), href).not.toBeNull();
    }
  });

  it("a nota de privacidade diz o que o produto faz", () => {
    expect(textOf(doc.getElementById("privacidade"))).toMatch(/fica só no seu aparelho/);
  });
});

describe("dialogo de instalacao", () => {
  const doc = loadLanding();
  const dialog = doc.querySelector("dialog#instalar");

  it("tem nome acessivel valido", () => {
    const id = dialog?.getAttribute("aria-labelledby");
    expect(id).toBeTruthy();
    expect(id && doc.getElementById(id)).not.toBeNull();
  });

  it("dois paineis com tres passos cada", () => {
    const panels = dialog?.querySelectorAll("[data-steps]") ?? [];
    expect([...panels].map((p) => p.getAttribute("data-steps"))).toEqual(["ios", "android"]);
    for (const p of panels) expect(p.querySelectorAll("li")).toHaveLength(3);
  });

  it("botao Fechar e link Usar no navegador para app/", () => {
    expect(dialog?.querySelector("button[data-dialog-close][aria-label='Fechar']")).not.toBeNull();
    const link = dialog?.querySelector("a.btn-secondary");
    expect(textOf(link)).toBe("Usar no navegador");
    expect(link?.getAttribute("href")).toBe("app/");
  });
});
