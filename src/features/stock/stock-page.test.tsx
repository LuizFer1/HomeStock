import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../app-context";
import { testContext } from "../../app-context.fake";
import { cafe } from "../../domain/model/item.fake";
import type { ItemStore } from "../item/store";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { LONG_PRESS_MS } from "../ui/long-press";
import { StockPage } from "./stock-page";

/** O Estoque nao usa o stepper; os fakes de `items` so precisam do tipo completo. */
const NO_STEP: Pick<ItemStore, "step" | "undo"> = {
  step: () => Promise.reject(new Error("nao usado")),
  undo: async () => {},
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Cafe abaixo do minimo no Armario, arroz em dia sem local; os dois na Despensa. */
async function seed(session: Session) {
  const armario = session.data.value.locations.find((l) => l.name === "Armário");
  const cafeItem = await session.run((repo) =>
    repo.createItem(cafe({ locationId: armario?.id ?? null }), 1),
  );
  const arroz = await session.run((repo) =>
    repo.createItem(cafe({ name: "Arroz agulhinha", size: "5 kg", min: 1, ean: null }), 2),
  );
  return { cafeItem, arroz };
}

async function setup(options: { empty?: boolean; overrides?: Partial<AppContext> } = {}) {
  const { session } = await openTestSession({ member: ANA });
  const seeded = options.empty ? null : await seed(session);
  const { ctx, history } = testContext(session, options.overrides);
  render(
    <>
      <StockPage ctx={ctx} />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  return { session, ctx, history, seeded };
}

function cards(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-item-id]"));
}

function card(name: string): HTMLElement {
  const found = cards().find((c) => c.textContent?.includes(name));
  if (found === undefined) throw new Error(`card ${name} nao achado`);
  return found;
}

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement;
}

describe("StockPage", () => {
  it("lista os cards em ordem de status, com estoque e nota", async () => {
    await setup();
    expect(cards().map((c) => c.textContent?.includes("Café em grãos"))).toEqual([true, false]);
    const first = card("Café em grãos");
    expect(first.textContent).toContain("1 pct");
    expect(first.textContent).toContain("Torrado 1 kg · Abaixo do mínimo");
    expect(card("Arroz agulhinha").textContent).toContain("5 kg · Em dia");
  });

  it("os cards apontam para a dica de long-press", async () => {
    await setup();
    const hint = screen.getByText(/^Segure um item para ações/);
    expect(hint.textContent).toContain("tecla de menu");
    expect(card("Café em grãos").getAttribute("aria-describedby")).toBe(hint.id);
  });

  it("busca e filtros por chip, com aria-pressed", async () => {
    const { ctx } = await setup();
    const search = screen.getByRole("searchbox", { name: "Buscar item ou código" });
    fireEvent.input(search, { target: { value: "arroz" } });
    expect(cards()).toHaveLength(1);
    expect(ctx.stock.query.value).toBe("arroz");
    fireEvent.input(search, { target: { value: "" } });

    const group = screen.getByRole("group", { name: "Filtros" });
    const todos = screen.getByRole("button", { name: "Todos 2" });
    expect(group.contains(todos)).toBe(true);
    expect(todos.getAttribute("aria-pressed")).toBe("true");

    const despensa = screen.getByRole("button", { name: "Despensa 2" });
    fireEvent.click(despensa);
    expect(despensa.getAttribute("aria-pressed")).toBe("true");
    expect(todos.getAttribute("aria-pressed")).toBe("false");
    expect(cards()).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Armário 1" }));
    expect(cards()).toHaveLength(1);
    expect(cards()[0]?.textContent).toContain("Café em grãos");
  });

  it("clique no card empilha o Detalhe e guarda a rolagem", async () => {
    const { ctx, history, seeded } = await setup();
    fireEvent.click(card("Café em grãos"), { detail: 1 });
    expect(history.pushState).toHaveBeenCalledTimes(1);
    expect(ctx.router.top.value).toEqual({ kind: "item", id: seeded?.cafeItem.id });
    expect(ctx.stock.scrollY.value).toBe(window.scrollY);
  });

  it("segurar 450 ms abre o sheet e o click seguinte nao empilha", async () => {
    const { ctx } = await setup();
    vi.useFakeTimers();
    const target = card("Café em grãos");
    fireEvent.pointerDown(target, { button: 0, isPrimary: true, clientX: 0, clientY: 0 });
    expect(target.className).toContain("scale-[0.96]");
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(dialog().open).toBe(true);
    expect(dialog().getAttribute("aria-label")).toBe("Ações de Café em grãos");
    fireEvent.pointerUp(target);
    fireEvent.click(target, { detail: 1 });
    expect(ctx.router.stack.value).toEqual([]);
  });

  it("contextmenu no card abre o sheet com a previa", async () => {
    await setup();
    fireEvent.contextMenu(card("Café em grãos"));
    expect(dialog().open).toBe(true);
    expect(dialog().textContent).toContain("Torrado 1 kg · Abaixo do mínimo");
    expect(dialog().textContent).toContain("1 pct");
  });

  it("Deletar remove o card, fecha, avisa e foca o titulo; Desfazer devolve e foca o card", async () => {
    const { session, seeded } = await setup();
    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));

    await waitFor(() => expect(cards()).toHaveLength(1));
    // O Sheet fecha num efeito, que o Preact roda depois da pintura.
    await waitFor(() => expect(dialog().open).toBe(false));
    expect(screen.getByRole("status").textContent).toContain("Café em grãos removido");
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Estoque" })),
    );

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(cards()).toHaveLength(2));
    await waitFor(() => expect(document.activeElement).toBe(card("Café em grãos")));
    expect(card("Café em grãos").textContent).toContain("1 pct");
    expect(session.data.value.items.find((i) => i.id === seeded?.cafeItem.id)?.deletedAt).toBe(
      null,
    );
  });

  it("falha ao deletar mostra o erro e o sheet fica aberto", async () => {
    await setup({
      overrides: {
        items: {
          ...NO_STEP,
          remove: async () => {
            throw new Error("Disco cheio.");
          },
          restore: async () => {},
        },
      },
    });
    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Disco cheio.");
    expect(dialog().open).toBe(true);
  });

  it("dois toques em Deletar removem uma vez so", async () => {
    const remove = vi.fn(async () => {});
    await setup({ overrides: { items: { ...NO_STEP, remove, restore: async () => {} } } });
    fireEvent.contextMenu(card("Café em grãos"));
    const del = screen.getByRole("button", { name: "Deletar" });
    fireEvent.click(del);
    fireEvent.click(del);
    await waitFor(() => expect(screen.getByRole("status").textContent).toContain("removido"));
    expect(remove).toHaveBeenCalledTimes(1);
  });

  it("o toast some depois de 4000 ms", async () => {
    await setup({
      overrides: { items: { ...NO_STEP, remove: async () => {}, restore: async () => {} } },
    });
    vi.useFakeTimers();
    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("status").textContent).toContain("Café em grãos removido");
    act(() => {
      vi.advanceTimersByTime(3999);
    });
    expect(screen.getByRole("status").textContent).toContain("removido");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("Editar empilha item-edit, Visualizar empilha item e Cancelar fecha", async () => {
    const { ctx, seeded } = await setup();
    const id = seeded?.cafeItem.id;
    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(dialog().open).toBe(false);
    expect(ctx.router.stack.value).toEqual([]);

    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(ctx.router.top.value).toEqual({ kind: "item-edit", id });
    expect(dialog().open).toBe(false);

    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Visualizar item" }));
    expect(ctx.router.top.value).toEqual({ kind: "item", id });
  });

  it("sem itens mostra o vazio e Adicionar item empilha item-new", async () => {
    const { ctx } = await setup({ empty: true });
    expect(screen.getByText("Seu estoque está vazio.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar item" }));
    expect(ctx.router.top.value).toEqual({ kind: "item-new" });
  });

  it("busca sem resultado avisa", async () => {
    await setup();
    fireEvent.input(screen.getByRole("searchbox", { name: "Buscar item ou código" }), {
      target: { value: "xyz" },
    });
    expect(screen.getByText("Nenhum item encontrado.")).toBeTruthy();
  });

  it("restaura a rolagem guardada uma vez so", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { ctx } = testContext(session);
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    ctx.stock.scrollY.value = 300;
    render(<StockPage ctx={ctx} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith(0, 300);
    expect(ctx.stock.scrollY.value).toBe(0);

    // Troca de aba e volta: nao pula de novo para a posicao velha.
    cleanup();
    render(<StockPage ctx={ctx} />);
    expect(scrollTo).toHaveBeenCalledTimes(1);
    scrollTo.mockRestore();
  });

  it("Desfazer com o card escondido pela busca foca o titulo", async () => {
    await setup();
    fireEvent.contextMenu(card("Café em grãos"));
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    await waitFor(() => expect(cards()).toHaveLength(1));
    fireEvent.input(screen.getByRole("searchbox", { name: "Buscar item ou código" }), {
      target: { value: "arroz" },
    });
    const undo = screen.getByRole("button", { name: "Desfazer" });
    undo.focus();
    fireEvent.click(undo);
    const heading = screen.getByRole("heading", { name: "Estoque" });
    await waitFor(() => expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(heading));
  });

  it("falha ao deletar e Cancelar nao manda o foco ao titulo", async () => {
    await setup({
      overrides: {
        items: {
          ...NO_STEP,
          remove: async () => {
            throw new Error("Disco cheio.");
          },
          restore: async () => {},
        },
      },
    });
    const target = card("Café em grãos");
    target.focus();
    fireEvent.contextMenu(target);
    fireEvent.click(screen.getByRole("button", { name: "Deletar" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(dialog().open).toBe(false));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(document.activeElement).toBe(target);
  });

  it("filtro e busca sobrevivem a remontagem (store)", async () => {
    const { ctx } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Armário 1" }));
    cleanup();
    render(<StockPage ctx={ctx} />);
    expect(screen.getByRole("button", { name: "Armário 1" }).getAttribute("aria-pressed")).toBe(
      "true",
    );
    expect(cards()).toHaveLength(1);
  });
});
