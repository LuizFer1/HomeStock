import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../app-context";
import { fakeUpdate, testContext } from "../../app-context.fake";
import { isAlive } from "../../domain/model/base";
import { cafe } from "../../domain/model/item.fake";
import { quantities } from "../../domain/projections/stock";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { ShoppingPage } from "./shopping-page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const CAFE = "Café em grãos Torrado 1 kg, 3 pct · Abaixo do mínimo";
const SABAO = "Sabão em pó 1,6 kg, 1 un · Esgotado";

const sabao = () =>
  cafe({ name: "Sabão em pó", size: "1,6 kg", unit: "un", ean: null, usualQty: 1 });

async function setup(
  seed: (session: Session) => Promise<void> = async () => {},
  overrides: Partial<AppContext> = {},
) {
  const { session } = await openTestSession({ member: ANA });
  await seed(session);
  const { ctx } = testContext(session, overrides);
  render(
    <>
      <ShoppingPage ctx={ctx} />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  return { session, ctx };
}

const seedCafeSabao = async (session: Session) => {
  await session.run((r) => r.createItem(cafe(), 1, 4290));
  await session.run((r) => r.createItem(sabao(), 0));
};

function cafeId(session: Session): string {
  const item = session.data.value.items.find((i) => i.name === "Café em grãos");
  if (item === undefined) throw new Error("cafe nao achado");
  return item.id;
}

function progress(): HTMLElement {
  return screen.getByRole("progressbar", { name: "Itens comprados" });
}

function repor(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Repor estoque" }) as HTMLButtonElement;
}

describe("ShoppingPage", () => {
  it("lista os gerados pelo estoque, esgotados primeiro, com a meta", async () => {
    await setup(seedCafeSabao);
    expect(screen.getByRole("heading", { level: 2, name: "Gerados pelo estoque" })).toBeTruthy();
    const boxes = screen.getAllByRole("checkbox");
    expect(boxes.map((b) => b.getAttribute("aria-label"))).toEqual([SABAO, CAFE]);
    expect(screen.getByText("1 un · Esgotado")).toBeTruthy();
    expect(screen.getByText("3 pct · Abaixo do mínimo")).toBeTruthy();
    expect(screen.queryByText("Pedidos da casa")).toBeNull();
    const section = screen.getByRole("region", { name: "Gerados pelo estoque" });
    expect(within(section).getAllByRole("checkbox")).toHaveLength(2);
  });

  it("marcar anda o progresso", async () => {
    await setup(seedCafeSabao);
    expect(progress().getAttribute("aria-valuetext")).toBe("0 de 2");
    expect(progress().getAttribute("aria-valuemax")).toBe("2");
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: CAFE }).getAttribute("aria-checked")).toBe(
        "true",
      ),
    );
    expect(progress().getAttribute("aria-valuetext")).toBe("1 de 2");
    expect(progress().getAttribute("aria-valuenow")).toBe("1");
    expect((progress().firstElementChild as HTMLElement).style.width).toBe("50%");
    expect(screen.getByText("1 de 2")).toBeTruthy();
  });

  it("o total soma os nao marcados e conta os sem preco", async () => {
    await setup(seedCafeSabao);
    expect(screen.getByText("Falta comprar")).toBeTruthy();
    expect(screen.getByText("R$ 128,70", { selector: "p" })).toBeTruthy();
    expect(screen.getByText("+ 1 sem preço")).toBeTruthy();
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    expect(await screen.findByText("R$ 0,00")).toBeTruthy();
    expect(screen.getByText("+ 1 sem preço")).toBeTruthy();
  });

  it("Repor estoque grava o restock, mostra o toast e desfaz", async () => {
    const { session } = await setup(seedCafeSabao);
    const id = cafeId(session);
    expect(repor().disabled).toBe(true);
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    await waitFor(() => expect(repor().disabled).toBe(false));
    const pricesBefore = session.data.value.prices.length;
    const movesBefore = new Set(session.data.value.movements.map((m) => m.id));
    fireEvent.click(repor());
    expect(await screen.findByText("Guardou 3 pct de Café em grãos")).toBeTruthy();
    const data = session.data.value;
    const added = data.movements.filter((m) => !movesBefore.has(m.id));
    expect(added.map((m) => [m.itemId, m.reason, m.delta])).toEqual([[id, "restock", 3]]);
    expect(data.prices.length).toBe(pricesBefore);
    expect(data.listMarks.filter((m) => isAlive(m) && m.itemId === id)).toEqual([]);
    expect(quantities(data.movements).get(id)).toBe(4);
    await waitFor(() => expect(screen.queryByRole("checkbox", { name: CAFE })).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { level: 1, name: "Compras" }),
      ),
    );

    const undo = screen.getByRole("button", { name: "Desfazer" });
    undo.focus();
    fireEvent.click(undo);
    await waitFor(() =>
      expect(screen.getByRole("checkbox", { name: CAFE }).getAttribute("aria-checked")).toBe(
        "true",
      ),
    );
    expect(quantities(session.data.value.movements).get(id)).toBe(1);
    // O botao do toast some: o foco nao cai no corpo da pagina.
    await waitFor(() =>
      expect(document.activeElement).toBe(
        screen.getByRole("heading", { level: 1, name: "Compras" }),
      ),
    );
  });

  it("pedido da casa marcado sai da lista sem movimento", async () => {
    const { session } = await setup(async (s) => {
      await s.run((r) => r.addListExtra("Banana"));
    });
    expect(screen.getByRole("heading", { level: 2, name: "Pedidos da casa" })).toBeTruthy();
    expect(screen.getByText("1 · pedido por Ana")).toBeTruthy();
    const moves = session.data.value.movements.length;
    fireEvent.click(screen.getByRole("checkbox", { name: "Banana, 1 · pedido por Ana" }));
    await waitFor(() => expect(repor().disabled).toBe(false));
    fireEvent.click(repor());
    expect(await screen.findByText("1 pedido saiu da lista")).toBeTruthy();
    expect(session.data.value.movements.length).toBe(moves);
    const banana = session.data.value.listExtras.find((e) => e.name === "Banana");
    expect(banana?.deletedAt).not.toBeNull();
  });

  it("repor item e pedido juntos fala dos dois", async () => {
    await setup(async (s) => {
      await s.run((r) => r.createItem(cafe(), 1));
      await s.run((r) => r.addListExtra("Banana"));
    });
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Banana, 1 · pedido por Ana" }));
    await waitFor(() => expect(progress().getAttribute("aria-valuetext")).toBe("2 de 2"));
    fireEvent.click(repor());
    expect(await screen.findByText("Guardou 1 item · 1 pedido saiu da lista")).toBeTruthy();
  });

  it("dois cliques seguidos em Repor gravam um lote so", async () => {
    const { session } = await setup(seedCafeSabao);
    const id = cafeId(session);
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    await waitFor(() => expect(repor().disabled).toBe(false));
    const movesBefore = session.data.value.movements.length;
    const button = repor();
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByText("Guardou 3 pct de Café em grãos")).toBeTruthy();
    const added = session.data.value.movements.slice(movesBefore);
    expect(added.map((m) => [m.itemId, m.delta])).toEqual([[id, 3]]);
  });

  it("falha no repor mostra o erro focado", async () => {
    const { ctx } = await setup(seedCafeSabao);
    ctx.shopping.checkout = () => Promise.reject(new Error("Sem espaço no aparelho."));
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    await waitFor(() => expect(repor().disabled).toBe(false));
    fireEvent.click(repor());
    const error = await screen.findByText("Sem espaço no aparelho.");
    await waitFor(() => expect(document.activeElement).toBe(error.parentElement));
    expect(repor().disabled).toBe(false);
  });

  it("falha ao marcar mostra o erro em alerta", async () => {
    const { ctx } = await setup(seedCafeSabao);
    ctx.shopping.toggle = () => Promise.reject(new Error("Não deu para marcar."));
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    expect((await screen.findByRole("alert")).textContent).toBe("Não deu para marcar.");
    ctx.shopping.toggle = async () => {};
    fireEvent.click(screen.getByRole("checkbox", { name: CAFE }));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("autoList desligado esconde os gerados e o vazio avisa", async () => {
    await setup(async (s) => {
      await s.run((r) => r.createItem(cafe(), 1));
      await s.run((r) => r.setPref("autoList", false));
    });
    expect(screen.queryByText("Gerados pelo estoque")).toBeNull();
    expect(screen.getByText("Nada para comprar.")).toBeTruthy();
    expect(screen.getByText("A lista automática está desligada nos Ajustes.")).toBeTruthy();
  });

  it("sem itens o vazio explica e nao ha progresso nem rodape", async () => {
    await setup();
    expect(screen.getByText("Nada para comprar.")).toBeTruthy();
    expect(screen.getByText("Itens abaixo do mínimo entram aqui sozinhos.")).toBeTruthy();
    expect(screen.queryByRole("progressbar")).toBeNull();
    expect(screen.queryByRole("button", { name: "Repor estoque" })).toBeNull();
  });

  it("o mercado preferido aparece no rodape", async () => {
    await setup(async (s) => {
      await seedCafeSabao(s);
      await s.run((r) => r.setPref("preferredStore", "Atacadão"));
    });
    expect(screen.getByText("Falta comprar · Atacadão")).toBeTruthy();
  });

  it("com o aviso de versao o rodape sobe", async () => {
    await setup(seedCafeSabao, { update: fakeUpdate(true) });
    const footer = repor().parentElement as HTMLElement;
    expect(footer.className).toContain("bottom-[164px]");
    expect(footer.className).not.toContain("bottom-[100px]");
    expect((document.querySelector("main") as HTMLElement).className).toContain("pb-[264px]");
  });

  it("sem o aviso o rodape fica a 100 px", async () => {
    await setup(seedCafeSabao);
    expect((repor().parentElement as HTMLElement).className).toContain("bottom-[100px]");
    expect((document.querySelector("main") as HTMLElement).className).toContain("pb-[200px]");
  });

  it("mostra os moradores", async () => {
    await setup();
    const group = screen.getByRole("group", { name: "Moradores" });
    expect(within(group).getByRole("img", { name: "Ana" })).toBeTruthy();
  });
});
