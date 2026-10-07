import "fake-indexeddb/auto";
import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testContext } from "./app-context.fake";
import { cafe } from "./domain/model/item.fake";
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

  it("alerts mostra a tela Alertas", async () => {
    const { ctx } = await setup();
    render(renderScreen({ kind: "alerts" }, ctx));
    expect(screen.getByRole("heading", { level: 1, name: "Alertas" })).toBeTruthy();
  });

  it("item mostra o Detalhe", async () => {
    const { ctx } = await setup();
    const item = await ctx.session.run((repo) => repo.createItem(cafe(), 2));
    ctx.router.push({ kind: "item", id: item.id });
    render(renderScreen({ kind: "item", id: item.id }, ctx));
    expect(screen.getByRole("heading", { level: 2, name: "Café em grãos" })).toBeTruthy();
  });

  it("item sem id volta", async () => {
    const { ctx, history } = await setup();
    ctx.router.push({ kind: "item" });
    render(renderScreen({ kind: "item" }, ctx));
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });

  it("scan mostra Novo item e o aviso de camera do ambiente padrao", async () => {
    const { ctx } = await setup();
    ctx.router.push({ kind: "scan" });
    render(renderScreen({ kind: "scan" }, ctx));
    expect(screen.getByRole("heading", { level: 1, name: "Novo item" })).toBeTruthy();
    expect(
      await screen.findByText("Este navegador não abre a câmera. Digite o código no campo abaixo."),
    ).toBeTruthy();
  });

  it("item-new mostra o formulario de criar com a camera parada", async () => {
    const { session } = await openTestSession({ member: ANA });
    const openCamera = vi.fn(async () => Promise.reject(new Error("nao devia abrir")));
    const { ctx } = testContext(session, {
      scanner: {
        openCamera,
        attach: async () => {},
        loadReader: async () => ({ read: async () => null }),
      },
    });
    ctx.router.push({ kind: "item-new" });
    render(renderScreen({ kind: "item-new" }, ctx));
    expect(screen.getByRole("heading", { level: 1, name: "Novo item" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ler código" })).toBeTruthy();
    await Promise.resolve();
    expect(openCamera).not.toHaveBeenCalled();
  });

  it("item-edit mostra o formulario com o item", async () => {
    const { ctx } = await setup();
    const item = await ctx.session.run((repo) => repo.createItem(cafe(), 2));
    ctx.router.push({ kind: "item-edit", id: item.id });
    render(renderScreen({ kind: "item-edit", id: item.id }, ctx));
    expect(screen.getByRole("heading", { level: 1, name: "Editar item" })).toBeTruthy();
    expect((screen.getByLabelText("Nome") as HTMLInputElement).value).toBe("Café em grãos");
  });

  it("item-edit sem id volta", async () => {
    const { ctx, history } = await setup();
    ctx.router.push({ kind: "item-edit" });
    render(renderScreen({ kind: "item-edit" }, ctx));
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });

  it("item-edit de item apagado volta", async () => {
    const { ctx, history } = await setup();
    const item = await ctx.session.run((repo) => repo.createItem(cafe(), 2));
    await ctx.session.run((repo) => repo.deleteItem(item.id));
    ctx.router.push({ kind: "item-edit", id: item.id });
    render(renderScreen({ kind: "item-edit", id: item.id }, ctx));
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
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
