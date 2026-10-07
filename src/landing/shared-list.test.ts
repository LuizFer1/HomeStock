import { beforeEach, describe, expect, it } from "vitest";
import { loadLanding } from "./landing-html.fake";
import { bindSharedList, listProgress } from "./shared-list";

describe("listProgress", () => {
  it("rotulo e largura da barra", () => {
    expect(listProgress(1, 5)).toEqual({ label: "1 de 5", width: "20%" });
    expect(listProgress(0, 5)).toEqual({ label: "0 de 5", width: "0%" });
    expect(listProgress(5, 5)).toEqual({ label: "5 de 5", width: "100%" });
    expect(listProgress(0, 0)).toEqual({ label: "0 de 0", width: "0%" });
  });
});

describe("bindSharedList", () => {
  const rows = () => [...document.querySelectorAll<HTMLButtonElement>("[data-list-item]")];
  const done = () => document.querySelector("[data-list-done]")?.textContent;
  const bar = () => document.querySelector<HTMLElement>("[data-list-bar]")?.style.width;

  beforeEach(() => {
    const casa = loadLanding().querySelector("#casa");
    if (!casa) throw new Error("secao #casa ausente no index.html");
    document.body.innerHTML = casa.outerHTML;
    bindSharedList(document);
  });

  it("comeca com o sabao marcado", () => {
    expect(rows().map((r) => r.getAttribute("aria-pressed"))).toEqual([
      "true",
      "false",
      "false",
      "false",
      "false",
    ]);
    expect(done()).toBe("1 de 5");
    expect(bar()).toBe("20%");
  });

  it("tocar marca e atualiza o progresso", () => {
    rows()[1]?.click();
    expect(rows()[1]?.getAttribute("aria-pressed")).toBe("true");
    expect(done()).toBe("2 de 5");
    expect(bar()).toBe("40%");
  });

  it("tocar de novo desmarca", () => {
    rows()[0]?.click();
    expect(rows()[0]?.getAttribute("aria-pressed")).toBe("false");
    expect(done()).toBe("0 de 5");
    expect(bar()).toBe("0%");
  });
});
