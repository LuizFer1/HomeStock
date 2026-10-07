import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANA, openTestSession } from "../session/test-session.fake";
import { SettingsPage } from "./settings-page";
import { createSettingsStore } from "./store";

afterEach(cleanup);

async function setup(version: string | null = null) {
  const { session } = await openTestSession({ member: ANA });
  const store = createSettingsStore(session, { download: vi.fn(), today: () => "2026-10-06" });
  const props = {
    onBack: vi.fn(),
    onEditProfile: vi.fn(),
    onOpenPlaces: vi.fn(),
    onLeave: vi.fn().mockResolvedValue(undefined),
  };
  render(<SettingsPage session={session} store={store} version={version} {...props} />);
  return { session, store, ...props };
}

describe("SettingsPage", () => {
  it("mostra o perfil do aparelho", async () => {
    await setup();
    expect(screen.getAllByText("Ana").length).toBeGreaterThan(0);
    expect(screen.getByText("Neste aparelho · Terracota")).toBeTruthy();
  });

  it("Editar e Voltar chamam os callbacks", async () => {
    const { onEditProfile, onBack } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onEditProfile).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });

  it("edita o nome da casa com Enter e cancela com Esc", async () => {
    const { session } = await setup();
    expect(screen.getByText("Casa de Ana")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Nome da casa/ }));
    const field = screen.getByLabelText("Nome da casa");
    fireEvent.input(field, { target: { value: "Casa da Vila" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(await screen.findByText("Casa da Vila")).toBeTruthy();
    expect(session.prefs.value.houseName).toBe("Casa da Vila");

    fireEvent.click(screen.getByRole("button", { name: /Nome da casa/ }));
    const again = screen.getByLabelText("Nome da casa");
    fireEvent.input(again, { target: { value: "Outro" } });
    fireEvent.keyDown(again, { key: "Escape" });
    expect(screen.getByText("Casa da Vila")).toBeTruthy();
    expect(session.prefs.value.houseName).toBe("Casa da Vila");
  });

  it("falha ao salvar mantem o campo aberto com o alerta", async () => {
    const { store } = await setup();
    vi.spyOn(store, "setPref").mockRejectedValue(new Error("disco cheio"));
    fireEvent.click(screen.getByRole("button", { name: /Nome da casa/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Salvar/ }));
    expect((await screen.findByRole("alert")).textContent).toContain("disco cheio");
    expect(screen.getByLabelText("Nome da casa")).toBeTruthy();
  });

  it("falha ao gravar um switch mostra o alerta na pagina", async () => {
    const { store } = await setup();
    vi.spyOn(store, "setPref").mockRejectedValueOnce(new Error("sem espaco"));
    fireEvent.click(screen.getByRole("switch", { name: "Atividade da casa" }));
    expect((await screen.findByRole("alert")).textContent).toContain("sem espaco");
  });

  it("o chip ativo usa aria-pressed", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "5 dias" }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "5 dias" }).getAttribute("aria-pressed")).toBe(
        "true",
      ),
    );
    expect(screen.getByRole("button", { name: "3 dias" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("Categorias e locais mostra a contagem e abre a tela", async () => {
    const { onOpenPlaces } = await setup();
    const row = screen.getByRole("button", { name: /Categorias e locais/ });
    expect(row.textContent).toContain("3 · 6");
    fireEvent.click(row);
    expect(onOpenPlaces).toHaveBeenCalled();
  });

  it("desligar Estoque baixo grava a preferencia", async () => {
    const { session } = await setup();
    fireEvent.click(screen.getByRole("switch", { name: "Estoque baixo" }));
    await waitFor(() => expect(session.prefs.value.alertLow).toBe(false));
    await waitFor(() =>
      expect(
        screen.getByRole("switch", { name: "Estoque baixo" }).getAttribute("aria-checked"),
      ).toBe("false"),
    );
  });

  it("chips de antecedencia gravam e somem com o alerta desligado", async () => {
    const { session } = await setup();
    expect(screen.getByText("Avisar 3 dias antes")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "5 dias" }));
    await waitFor(() => expect(session.prefs.value.expiringDays).toBe(5));
    expect(await screen.findByText("Avisar 5 dias antes")).toBeTruthy();
    fireEvent.click(screen.getByRole("switch", { name: "Vencimento próximo" }));
    await waitFor(() =>
      expect(screen.queryByRole("group", { name: "Dias de antecedência" })).toBeNull(),
    );
  });

  it("Mercado preferido mostra Nenhum e salva um nome", async () => {
    const { session } = await setup();
    expect(screen.getByText("Nenhum")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Mercado preferido/ }));
    fireEvent.input(screen.getByLabelText("Mercado preferido"), { target: { value: "Mercadão" } });
    fireEvent.click(screen.getByRole("button", { name: /^Salvar/ }));
    expect(await screen.findByText("Mercadão")).toBeTruthy();
    expect(session.prefs.value.preferredStore).toBe("Mercadão");
  });

  it("mostra a data da versao, ou so o nome", async () => {
    await setup("2026-10-06T12:00:00.000Z");
    expect(screen.getByText("HomeStock · versão de 06/10/2026")).toBeTruthy();
    cleanup();
    await setup(null);
    expect(screen.getByText("HomeStock")).toBeTruthy();
  });

  it("Exportar estoque chama o store", async () => {
    const { store } = await setup();
    const spy = vi.spyOn(store, "exportStock").mockImplementation(() => {});
    const row = screen.getByRole("button", { name: /Exportar estoque/ });
    expect(row.textContent).toContain("CSV");
    fireEvent.click(row);
    expect(spy).toHaveBeenCalled();
  });

  it("tem o botao Sair da casa", async () => {
    await setup();
    expect(screen.getByRole("button", { name: "Sair da casa" })).toBeTruthy();
  });

  it("nao mostra o que a fatia nao entrega", async () => {
    await setup();
    for (const text of ["Resumo semanal", "Notas fiscais", "Convidar"]) {
      expect(screen.queryByText(new RegExp(text))).toBeNull();
    }
  });
});
