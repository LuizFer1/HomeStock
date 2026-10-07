import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testContext } from "./app-context.fake";
import { ANA, openTestSession } from "./features/session/test-session.fake";
import { renderScreen } from "./screens";

afterEach(cleanup);

async function setup() {
  const { session } = await openTestSession({ member: ANA });
  return testContext(session);
}

describe("renderScreen", () => {
  it("settings mostra os Ajustes", async () => {
    const { ctx } = await setup();
    render(renderScreen({ kind: "settings" }, ctx));
    expect(screen.getByRole("heading", { level: 1, name: "Ajustes" })).toBeTruthy();
  });

  it("places mostra Categorias e locais", async () => {
    const { ctx } = await setup();
    render(renderScreen({ kind: "places" }, ctx));
    expect(screen.getByRole("heading", { name: "Categorias e locais" })).toBeTruthy();
  });

  it("profile mostra o wizard de edicao com o nome do morador", async () => {
    const { ctx } = await setup();
    render(renderScreen({ kind: "profile" }, ctx));
    expect((screen.getByLabelText("Seu nome") as HTMLInputElement).value).toBe("Ana");
  });

  it("tela desconhecida volta", async () => {
    const { ctx, history } = await setup();
    ctx.router.push({ kind: "nada" });
    render(renderScreen({ kind: "nada" }, ctx));
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });

  it("kind que coincide com membro do prototipo nao vira tela", async () => {
    const { ctx, history } = await setup();
    ctx.router.push({ kind: "toString" });
    render(renderScreen({ kind: "toString" }, ctx));
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });
});
