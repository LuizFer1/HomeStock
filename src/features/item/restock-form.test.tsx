import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { testContext } from "../../app-context.fake";
import type { Draft } from "../../domain/model/base";
import type { Item } from "../../domain/model/item";
import { cafe } from "../../domain/model/item.fake";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { RestockForm } from "./restock-form";

afterEach(cleanup);

interface SetupOptions {
  draft?: Partial<Draft<Item>>;
  qty?: number;
  prepare?: (session: Session, item: Item) => Promise<void>;
}

async function setup(options: SetupOptions = {}) {
  const { session } = await openTestSession({ member: ANA });
  const item = await session.run((repo) => repo.createItem(cafe(options.draft), options.qty ?? 2));
  await options.prepare?.(session, item);
  const { ctx, history } = testContext(session);
  ctx.router.push({ kind: "scan" });
  render(
    <>
      <RestockForm ctx={ctx} item={item} top={<p>Visor</p>} screenKind="scan" />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  const restocks = () =>
    session.data.value.movements.filter((m) => m.itemId === item.id && m.reason === "restock");
  const prices = () => session.data.value.prices.filter((p) => p.itemId === item.id);
  const current = () => session.data.value.items.find((i) => i.id === item.id);
  return { session, ctx, history, item, restocks, prices, current };
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function button(name: string | RegExp): HTMLButtonElement {
  return screen.getByRole("button", { name }) as HTMLButtonElement;
}

function banner(): HTMLElement {
  const found = screen
    .getAllByRole("status")
    .find((el) => el.textContent?.includes("Achamos!") === true);
  if (found === undefined) throw new Error("sem banner");
  return found;
}

describe("RestockForm", () => {
  it("mostra o banner Achamos!, sem Categoria, e foca o titulo", async () => {
    await setup();
    expect(banner().textContent).toContain("Achamos! Café em grãos Torrado 1 kg");
    expect(banner().textContent).toContain("Já existe no estoque · vamos somar");
    expect(screen.queryByText("Categoria")).toBeNull();
    expect(document.activeElement).toBe(
      screen.getByRole("heading", { level: 1, name: "Novo item" }),
    );
    expect(screen.getByText("Visor")).toBeTruthy();
  });

  it("banner sem tamanho mostra so o nome", async () => {
    await setup({ draft: { size: "" } });
    expect(banner().textContent).toContain("Achamos! Café em grãosJá existe");
  });

  it("quantidade comeca na compra usual, com o estoque no hint e o total com preco", async () => {
    await setup();
    const stepper = screen.getByRole("group", { name: "Quantidade" });
    expect(stepper.textContent).toContain("3");
    expect(screen.getByText("Você tem 2 pct")).toBeTruthy();
    expect(button("Guardar 3 pct")).toBeTruthy();
    fireEvent.input(field("Preço unitário"), { target: { value: "4290" } });
    expect(button(/Guardar 3 · R\$\s128,70/)).toBeTruthy();
  });

  it("salvar grava restock e preco, mostra o toast, volta, e Desfazer apaga os dois", async () => {
    const { restocks, prices, ctx } = await setup();
    fireEvent.input(field("Preço unitário"), { target: { value: "4290" } });
    fireEvent.click(button(/Guardar 3 ·/));
    await waitFor(() => expect(restocks()).toHaveLength(1));
    expect(restocks()[0]?.delta).toBe(3);
    expect(prices()).toHaveLength(1);
    expect(prices()[0]?.unitPriceMinor).toBe(4290);
    expect(prices()[0]?.qty).toBe(3);
    expect(await screen.findByText("Guardou 3 pct de Café em grãos")).toBeTruthy();
    await waitFor(() => expect(ctx.router.stack.value).toEqual([]));

    fireEvent.click(button("Desfazer"));
    await waitFor(() => expect(restocks()[0]?.deletedAt).not.toBeNull());
    await waitFor(() => expect(prices()[0]?.deletedAt).not.toBeNull());
  });

  it("validade com estoque fica a menor das duas", async () => {
    const { current, restocks } = await setup({ draft: { expiresAt: "2026-12-01" } });
    fireEvent.input(field("Validade"), { target: { value: "2027-03-01" } });
    fireEvent.click(button("Guardar 3 pct"));
    await waitFor(() => expect(restocks()).toHaveLength(1));
    expect(current()?.expiresAt).toBe("2026-12-01");
  });

  it("validade sem estoque passa a nova, e Desfazer devolve a anterior", async () => {
    const { current, restocks } = await setup({ draft: { expiresAt: "2026-12-01" }, qty: 0 });
    fireEvent.input(field("Validade"), { target: { value: "2027-03-01" } });
    fireEvent.click(button("Guardar 3 pct"));
    await waitFor(() => expect(restocks()).toHaveLength(1));
    expect(current()?.expiresAt).toBe("2027-03-01");
    fireEvent.click(await screen.findByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(current()?.expiresAt).toBe("2026-12-01"));
  });

  it("placeholder do preco sem historico e R$ 0,00", async () => {
    await setup();
    expect(field("Preço unitário").placeholder).toBe("R$ 0,00");
  });

  it("placeholder do preco e o ultimo pago", async () => {
    await setup({
      prepare: async (session, item) => {
        await session.run((repo) => repo.restock(item.id, 1, 3990));
      },
    });
    expect(field("Preço unitário").placeholder.replace(/ /g, " ")).toBe("R$ 39,90");
  });

  it("dois cliques seguidos em Guardar gravam um movimento", async () => {
    const { restocks, ctx } = await setup();
    fireEvent.click(button("Guardar 3 pct"));
    fireEvent.click(button("Guardar 3 pct"));
    await waitFor(() => expect(ctx.router.stack.value).toEqual([]));
    expect(restocks()).toHaveLength(1);
  });

  it("falha mostra o erro, foca a mensagem e nao volta", async () => {
    const { session, item, ctx, history } = await setup();
    await session.run((repo) => repo.deleteItem(item.id));
    fireEvent.click(button("Guardar 3 pct"));
    const message = await screen.findByText(/nao existe/);
    await waitFor(() => expect(document.activeElement).toBe(message.parentElement));
    expect(history.back).not.toHaveBeenCalled();
    expect(ctx.router.stack.value.map((s) => s.kind)).toEqual(["scan"]);
    expect(button("Guardar 3 pct").disabled).toBe(false);
  });
});
