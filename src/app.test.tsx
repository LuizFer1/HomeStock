import { signal } from "@preact/signals";
import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "./app";
import { createRouter } from "./features/shell/route";
import type { UpdateStore } from "./features/update/store";

function setup(ready = false) {
  const router = createRouter({ pushState: () => {}, back: () => {} });
  const update: UpdateStore = {
    ready: signal(ready),
    check: async () => "current",
    apply: () => {},
    version: null,
  };
  render(<App router={router} update={update} />);
  return router;
}

afterEach(cleanup);

describe("App", () => {
  it("abre no Inicio", () => {
    setup();
    expect(screen.getByRole("heading", { name: "Início" })).toBeTruthy();
  });

  it("troca de tela pela tab bar", async () => {
    const router = setup();
    fireEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(router.tab.value).toBe("stock");
    expect(await screen.findByRole("heading", { name: "Estoque" })).toBeTruthy();
  });

  it("mostra o aviso de versao nova", () => {
    setup(true);
    expect(screen.getByText("Nova versão disponível")).toBeTruthy();
  });
});
