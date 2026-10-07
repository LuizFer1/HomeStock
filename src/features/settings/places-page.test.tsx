import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cafe } from "../../data/test-db.fake";
import { DEFAULT_CATEGORY_ID } from "../../domain/defaults/seeds";
import { ANA, openTestSession } from "../session/test-session.fake";
import { PlacesPage } from "./places-page";
import { createSettingsStore, type SettingsStore } from "./store";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** `prepare` roda antes do render: a pagina captura `store.upsert*` ao montar. */
async function setup(prepare?: (store: SettingsStore) => void) {
  const { session } = await openTestSession({ member: ANA });
  const store = createSettingsStore(session, { download: vi.fn(), today: () => "2026-10-06" });
  prepare?.(store);
  const onBack = vi.fn();
  render(<PlacesPage session={session} store={store} onBack={onBack} />);
  return { session, store, onBack };
}

function names(section: string): string[] {
  const group = screen.getByRole("region", { name: section });
  return within(group)
    .getAllByRole("button", { name: /^Renomear / })
    .map((b) => (b.getAttribute("aria-label") ?? "").replace("Renomear ", ""));
}

describe("PlacesPage", () => {
  it("lista as categorias e os locais em ordem alfabetica", async () => {
    await setup();
    expect(names("Categorias")).toEqual(["Despensa", "Higiene", "Limpeza"]);
    expect(names("Locais")).toEqual([
      "Área de serviço",
      "Armário",
      "Banheiro",
      "Freezer",
      "Geladeira",
      "Lavanderia",
    ]);
  });

  it("Voltar chama onBack", async () => {
    const { onBack } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onBack).toHaveBeenCalled();
  });

  it("adiciona uma categoria, limpa o campo e recusa repetida", async () => {
    await setup();
    const add = screen.getByRole("button", { name: "Adicionar categoria" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
    const field = screen.getByLabelText("Nova categoria") as HTMLInputElement;
    fireEvent.input(field, { target: { value: "Bebidas" } });
    fireEvent.click(add);
    expect(await screen.findByRole("button", { name: "Renomear Bebidas" })).toBeTruthy();
    await waitFor(() => expect(field.value).toBe(""));

    fireEvent.input(field, { target: { value: "despensa" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar categoria" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Já existe Despensa.");
    expect(field.value).toBe("despensa");
  });

  it("adiciona um local", async () => {
    await setup();
    fireEvent.input(screen.getByLabelText("Novo local"), { target: { value: "Garagem" } });
    fireEvent.click(screen.getByRole("button", { name: "Adicionar local" }));
    expect(await screen.findByRole("button", { name: "Renomear Garagem" })).toBeTruthy();
  });

  it("renomeia Freezer para Congelador com Enter e cancela com Esc", async () => {
    const { session } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Renomear Freezer" }));
    const field = screen.getByLabelText("Nome de Freezer");
    expect(document.activeElement).toBe(field);
    fireEvent.input(field, { target: { value: "Congelador" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(await screen.findByRole("button", { name: "Renomear Congelador" })).toBeTruthy();
    expect(session.data.value.locations.some((l) => l.name === "Congelador")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Renomear Congelador" }));
    const again = screen.getByLabelText("Nome de Congelador");
    fireEvent.input(again, { target: { value: "Outro" } });
    fireEvent.keyDown(again, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Renomear Congelador" })).toBeTruthy();
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Renomear Congelador" }),
    );
  });

  it("renomear para nome repetido mostra o erro e mantem o campo", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Renomear Freezer" }));
    const field = screen.getByLabelText("Nome de Freezer");
    fireEvent.input(field, { target: { value: "geladeira" } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Freezer" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Já existe Geladeira.");
    expect(screen.getByLabelText("Nome de Freezer")).toBeTruthy();
  });

  it("remove na hora uma categoria sem itens", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Remover Higiene" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Renomear Higiene" })).toBeNull(),
    );
  });

  it("com itens: conta, pede segundo toque e so entao remove", async () => {
    const { session } = await setup();
    await act(async () => {
      await session.run((r) => r.createItem(cafe({ categoryId: DEFAULT_CATEGORY_ID }), 1));
    });
    expect(await screen.findByText("1 item")).toBeTruthy();
    expect(screen.getAllByText("Nenhum item").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: "Remover Despensa" }));
    expect(screen.getByRole("button", { name: "Confirmar remoção de Despensa" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Renomear Despensa" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Confirmar remoção de Despensa" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Renomear Despensa" })).toBeNull(),
    );
  });

  it("o Remover? some depois de 4 segundos", async () => {
    const { session } = await setup();
    await act(async () => {
      await session.run((r) => r.createItem(cafe({ categoryId: DEFAULT_CATEGORY_ID }), 1));
    });
    await screen.findByText("1 item");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Remover Despensa" }));
    expect(screen.getByRole("button", { name: "Confirmar remoção de Despensa" })).toBeTruthy();
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(screen.getByRole("button", { name: "Remover Despensa" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Confirmar remoção de Despensa" })).toBeNull();
  });

  it("o foco acompanha o Remover?: vai ao botao, volta a lixeira e passa ao campo", async () => {
    const { session } = await setup();
    await act(async () => {
      await session.run((r) => r.createItem(cafe({ categoryId: DEFAULT_CATEGORY_ID }), 1));
    });
    await screen.findByText("1 item");
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Remover Despensa" }));
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Confirmar remoção de Despensa" }),
    );
    act(() => {
      vi.advanceTimersByTime(4100);
    });
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Remover Despensa" }));
  });

  it("depois de remover, o foco vai ao campo Nova categoria", async () => {
    await setup();
    fireEvent.click(screen.getByRole("button", { name: "Remover Higiene" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Renomear Higiene" })).toBeNull(),
    );
    expect(document.activeElement).toBe(screen.getByLabelText("Nova categoria"));
  });

  it("renomear para o mesmo nome fecha o campo sem gravar", async () => {
    let spy: ReturnType<typeof vi.spyOn> | undefined;
    await setup((store) => {
      spy = vi.spyOn(store, "upsertLocation");
    });
    fireEvent.click(screen.getByRole("button", { name: "Renomear Freezer" }));
    fireEvent.input(screen.getByLabelText("Nome de Freezer"), { target: { value: " Freezer " } });
    fireEvent.click(screen.getByRole("button", { name: "Salvar Freezer" }));
    expect(screen.queryByLabelText("Nome de Freezer")).toBeNull();
    expect(spy).toBeDefined();
    expect(spy).not.toHaveBeenCalled();
  });
});
