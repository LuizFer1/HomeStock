import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../app-context";
import { testContext } from "../../app-context.fake";
import { DEFAULT_CATEGORY_ID } from "../../domain/defaults/seeds";
import type { Draft } from "../../domain/model/base";
import { isAlive } from "../../domain/model/base";
import type { Item } from "../../domain/model/item";
import { cafe } from "../../domain/model/item.fake";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { ItemForm } from "./item-form";

afterEach(cleanup);

interface SetupOptions {
  mode?: "create" | "edit";
  draft?: Partial<Draft<Item>>;
  qty?: number;
  prepare?: (session: Session, item: Item) => Promise<void>;
  overrides?: Partial<AppContext>;
}

async function setup(options: SetupOptions = {}) {
  const { session } = await openTestSession({ member: ANA });
  const mode = options.mode ?? "create";
  const item =
    mode === "edit"
      ? await session.run((repo) => repo.createItem(cafe(options.draft), options.qty ?? 2))
      : undefined;
  if (item !== undefined) await options.prepare?.(session, item);
  const { ctx, history } = testContext(session, options.overrides);
  ctx.router.push(mode === "edit" ? { kind: "item-edit", id: item?.id } : { kind: "item-new" });
  render(
    <>
      <ItemForm ctx={ctx} mode={mode} id={item?.id} />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  const alive = () => session.data.value.items.filter((i) => isAlive(i));
  const moves = (id: string) => session.data.value.movements.filter((m) => m.itemId === id);
  return { session, ctx, history, item, alive, moves };
}

/** O toast; os `<output>` dos steppers tambem tem o papel status. */
function toastText(): string {
  return document.querySelector("div[role=status]")?.textContent ?? "";
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function type(label: string, value: string) {
  fireEvent.input(field(label), { target: { value } });
}

function button(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function chip(group: string, name: string): HTMLButtonElement {
  return within(screen.getByRole("group", { name: group })).getByRole("button", {
    name,
  }) as HTMLButtonElement;
}

function pickFile(label: string) {
  const input = field(label);
  fireEvent.change(input, { target: { files: [new File(["x"], "foto.jpg")] } });
}

describe("ItemForm criar", () => {
  it("cria com os campos, a quantidade inicial e o toast, e volta", async () => {
    const { history, alive, moves } = await setup();
    expect(screen.getByRole("heading", { level: 1, name: "Novo item" })).toBeTruthy();
    expect(button("Guardar 1 un").disabled).toBe(true);

    type("Nome", "Arroz");
    type("Tamanho", "5 kg");
    type("Unidade", "pct");
    fireEvent.click(button("Aumentar Quantidade"));
    fireEvent.click(button("Aumentar Quantidade"));
    fireEvent.click(chip("Categoria", "Limpeza"));
    fireEvent.click(chip("Local", "Armário"));
    expect(chip("Categoria", "Limpeza").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Categoria", "Despensa").getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button("Guardar 3 pct"));
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    const [arroz] = alive();
    expect(arroz).toMatchObject({ name: "Arroz", size: "5 kg", unit: "pct", min: 1, usualQty: 1 });
    expect(arroz?.ean).toBeNull();
    expect(arroz?.expiresAt).toBeNull();
    expect(moves(arroz?.id ?? "").map((m) => [m.reason, m.delta])).toEqual([["initial", 3]]);
    expect(toastText()).toContain("Arroz guardado");
  });

  it("padroes: Despensa ativa, local Nenhum, unidade un", async () => {
    await setup();
    expect(chip("Categoria", "Despensa").getAttribute("aria-pressed")).toBe("true");
    expect(chip("Local", "Nenhum").getAttribute("aria-pressed")).toBe("true");
    expect(field("Unidade").value).toBe("un");
    expect(document.activeElement).toBe(field("Nome"));
  });

  it("grava a categoria e o local escolhidos", async () => {
    const { session, alive } = await setup();
    type("Nome", "Sabão");
    fireEvent.click(chip("Categoria", "Limpeza"));
    fireEvent.click(chip("Local", "Lavanderia"));
    fireEvent.click(button("Guardar 1 un"));
    await waitFor(() => expect(alive()).toHaveLength(1));
    const { categories, locations } = session.data.value;
    expect(categories.find((c) => c.id === alive()[0]?.categoryId)?.name).toBe("Limpeza");
    expect(locations.find((l) => l.id === alive()[0]?.locationId)?.name).toBe("Lavanderia");
  });

  it("os tres steppers tem botoes com nomes distintos", async () => {
    await setup();
    for (const label of ["Quantidade", "Mínimo", "Compra usual"]) {
      expect(button(`Diminuir ${label}`)).toBeTruthy();
      expect(button(`Aumentar ${label}`)).toBeTruthy();
    }
    // No criar a quantidade comeca no minimo 1.
    expect(button("Diminuir Quantidade").disabled).toBe(true);
  });

  it("todos os campos de texto tem rotulo visivel", async () => {
    await setup();
    for (const label of ["Nome", "Tamanho", "Unidade", "Validade", "Código de barras"]) {
      const input = field(label);
      expect(input.tagName).toBe("INPUT");
      expect(input.getAttribute("aria-label")).toBeNull();
    }
    expect(field("Validade").type).toBe("date");
    expect(field("Código de barras").inputMode).toBe("numeric");
  });

  it("EAN invalido mostra o erro e nao grava", async () => {
    const { alive, history } = await setup();
    type("Nome", "Arroz");
    type("Código de barras", "123");
    fireEvent.click(button("Guardar 1 un"));
    const alert = await screen.findByText("O código de barras tem de 8 a 14 dígitos.");
    expect(alert.getAttribute("role")).toBe("alert");
    expect(alive()).toHaveLength(0);
    expect(history.back).not.toHaveBeenCalled();
    // O erro nao e do nome: o foco vai a mensagem.
    await waitFor(() => expect(document.activeElement?.contains(alert)).toBe(true));
  });

  it("EAN de outro item mostra quem ja o usa", async () => {
    const { session, alive } = await setup();
    await session.run((repo) => repo.createItem(cafe(), 1));
    type("Nome", "Arroz");
    type("Código de barras", "7891234567890");
    fireEvent.click(button("Guardar 1 un"));
    expect(await screen.findByText("O código 7891234567890 já é de Café em grãos.")).toBeTruthy();
    expect(alive()).toHaveLength(1);
  });

  it("validade e codigo vao normalizados", async () => {
    const { alive } = await setup();
    type("Nome", "Leite");
    type("Validade", "2027-04-12");
    type("Código de barras", " 78912345 ");
    fireEvent.click(button("Guardar 1 un"));
    await waitFor(() => expect(alive()).toHaveLength(1));
    expect(alive()[0]).toMatchObject({ expiresAt: "2027-04-12", ean: "78912345" });
  });

  it("dois cliques seguidos em Guardar gravam uma vez", async () => {
    const { alive, history } = await setup();
    type("Nome", "Arroz");
    const cta = button("Guardar 1 un");
    // No mesmo act: o segundo toque chega antes do render que desabilita o botao.
    act(() => {
      cta.click();
      cta.click();
    });
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    expect(alive()).toHaveLength(1);
  });

  it("Fechar volta sem gravar", async () => {
    const { history, alive } = await setup();
    type("Nome", "Arroz");
    fireEvent.click(button("Fechar"));
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    expect(alive()).toHaveLength(0);
  });
});

describe("ItemForm editar", () => {
  it("mostra os valores atuais e foca o titulo", async () => {
    await setup({ mode: "edit", draft: { expiresAt: "2027-04-12" } });
    const heading = screen.getByRole("heading", { level: 1, name: "Editar item" });
    expect(document.activeElement).toBe(heading);
    expect(field("Nome").value).toBe("Café em grãos");
    expect(field("Tamanho").value).toBe("Torrado 1 kg");
    expect(field("Unidade").value).toBe("pct");
    expect(field("Validade").value).toBe("2027-04-12");
    expect(field("Código de barras").value).toBe("7891234567890");
    const qty = within(screen.getByRole("group", { name: "Quantidade" }));
    expect(qty.getByText("2")).toBeTruthy();
    const min = within(screen.getByRole("group", { name: "Mínimo" }));
    expect(min.getByText("2")).toBeTruthy();
    expect(chip("Categoria", "Despensa").getAttribute("aria-pressed")).toBe("true");
    expect(button("Salvar")).toBeTruthy();
  });

  it("mudar o minimo grava min e nenhum movimento", async () => {
    const { session, item, moves, history } = await setup({ mode: "edit" });
    const before = moves(item?.id ?? "").length;
    fireEvent.click(button("Aumentar Mínimo"));
    fireEvent.click(button("Salvar"));
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    expect(session.data.value.items.find((i) => i.id === item?.id)?.min).toBe(3);
    expect(moves(item?.id ?? "")).toHaveLength(before);
    // Editar nao mostra toast.
    expect(toastText()).toBe("");
  });

  it("mudar a quantidade de 2 para 5 grava adjust +3", async () => {
    const { item, moves, history } = await setup({ mode: "edit" });
    for (let i = 0; i < 3; i += 1) fireEvent.click(button("Aumentar Quantidade"));
    fireEvent.click(button("Salvar"));
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    const adjusts = moves(item?.id ?? "").filter((m) => m.reason === "adjust");
    expect(adjusts.map((m) => m.delta)).toEqual([3]);
  });

  it("no editar a quantidade desce ate 0", async () => {
    await setup({ mode: "edit", qty: 1 });
    fireEvent.click(button("Diminuir Quantidade"));
    expect(button("Diminuir Quantidade").disabled).toBe(true);
  });

  it("categoria apagada: nenhum chip ativo e salvar pede uma categoria", async () => {
    const { session, history } = await setup({
      mode: "edit",
      prepare: async (s) => {
        await s.run((repo) => repo.removeCategory(DEFAULT_CATEGORY_ID));
      },
    });
    const group = within(screen.getByRole("group", { name: "Categoria" }));
    const pressed = group
      .getAllByRole("button")
      .filter((b) => b.getAttribute("aria-pressed") === "true");
    expect(pressed).toHaveLength(0);
    expect(group.queryByRole("button", { name: "Despensa" })).toBeNull();
    fireEvent.click(button("Salvar"));
    expect(await screen.findByText("Escolha uma categoria.")).toBeTruthy();
    expect(history.back).not.toHaveBeenCalled();
    expect(session.data.value.items[0]?.categoryId).toBe(DEFAULT_CATEGORY_ID);
  });

  it("item apagado volta", async () => {
    const { history } = await setup({
      mode: "edit",
      prepare: async (s, item) => {
        await s.run((repo) => repo.deleteItem(item.id));
      },
    });
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("heading", { name: "Editar item" })).toBeNull();
  });

  it("voltar do sistema durante a gravacao nao chama um segundo back", async () => {
    const { session, ctx, history } = await setup({ mode: "edit" });
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realRun = session.run;
    session.run = (async (command) => {
      await gate;
      return realRun(command);
    }) as typeof session.run;
    fireEvent.click(button("Aumentar Mínimo"));
    fireEvent.click(button("Salvar"));
    ctx.router.onPopState();
    expect(ctx.router.stack.value).toEqual([]);
    release();
    await waitFor(() => expect(session.data.value.items[0]?.min).toBe(3));
    await act(async () => {
      await Promise.resolve();
    });
    expect(history.back).not.toHaveBeenCalled();
  });
});

describe("ItemForm foto", () => {
  it("escolher mostra a foto e Remover foto limpa", async () => {
    const { alive } = await setup();
    expect(screen.queryByRole("img", { name: "Foto do item" })).toBeNull();
    pickFile("Galeria");
    expect(await screen.findByRole("img", { name: "Foto do item" })).toBeTruthy();
    fireEvent.click(button("Remover foto"));
    expect(screen.queryByRole("img", { name: "Foto do item" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover foto" })).toBeNull();

    pickFile("Câmera");
    await screen.findByRole("img", { name: "Foto do item" });
    type("Nome", "Arroz");
    fireEvent.click(button("Guardar 1 un"));
    await waitFor(() => expect(alive()).toHaveLength(1));
    expect(alive()[0]?.photo).toBe("data:image/webp;base64,AAA");
  });

  it("a camera pede a traseira", async () => {
    await setup();
    expect(field("Câmera").getAttribute("capture")).toBe("environment");
  });

  it("uma escolha lenta que chega depois de Remover foto nao volta", async () => {
    let resolveSlow: (value: string) => void = () => {};
    const processItemPhoto = vi
      .fn()
      .mockResolvedValueOnce("data:image/webp;base64,AAA")
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveSlow = resolve;
          }),
      );
    await setup({ overrides: { processItemPhoto } });
    pickFile("Galeria");
    await screen.findByRole("img", { name: "Foto do item" });
    pickFile("Galeria");
    fireEvent.click(button("Remover foto"));
    await act(async () => {
      resolveSlow("data:image/webp;base64,BBB");
      await Promise.resolve();
    });
    expect(screen.queryByRole("img", { name: "Foto do item" })).toBeNull();
  });

  it("falha do pipeline aparece em alerta", async () => {
    const processItemPhoto = vi.fn().mockRejectedValue(new Error("Não foi possível ler a foto."));
    await setup({ overrides: { processItemPhoto } });
    pickFile("Galeria");
    expect(await screen.findByText("Não foi possível ler a foto.")).toBeTruthy();
  });
});
