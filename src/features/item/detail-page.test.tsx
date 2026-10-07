import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { AppContext } from "../../app-context";
import { testContext } from "../../app-context.fake";
import type { Draft } from "../../domain/model/base";
import type { Item } from "../../domain/model/item";
import { cafe } from "../../domain/model/item.fake";
import type { Movement } from "../../domain/model/movement";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { ItemDetailPage } from "./detail-page";
import { createItemStore } from "./store";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DAY_MS = 86_400_000;

interface SetupOptions {
  draft?: Partial<Draft<Item>>;
  qty?: number;
  /** Roda antes do render, com o relogio da sessao na mao. */
  prepare?: (
    session: Session,
    item: Item,
    clock: { advance: (ms: number) => void },
  ) => Promise<void>;
  overrides?: (session: Session) => Partial<AppContext>;
}

async function setup(options: SetupOptions = {}) {
  // Relogio controlado: os usos do consumo precisam de datas diferentes.
  let millis = 1_790_000_000_000;
  const clock = { advance: (ms: number) => (millis += ms) };
  const { session } = await openTestSession({
    member: ANA,
    now: () => {
      millis += 1;
      return millis;
    },
  });
  const item = await session.run((repo) => repo.createItem(cafe(options.draft), options.qty ?? 2));
  await options.prepare?.(session, item, clock);
  const { ctx, history } = testContext(session, options.overrides?.(session));
  ctx.router.push({ kind: "item", id: item.id });
  const view = render(
    <>
      <ItemDetailPage ctx={ctx} id={item.id} />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  const moves = (reason: Movement["reason"]) =>
    session.data.value.movements.filter((m) => m.itemId === item.id && m.reason === reason);
  return { session, ctx, history, item, moves, view };
}

function stepper() {
  return within(screen.getByRole("group", { name: "Quantidade" }));
}

function useButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Usar um" }) as HTMLButtonElement;
}

function addButton(): HTMLButtonElement {
  return screen.getByRole("button", { name: "Adicionar um" }) as HTMLButtonElement;
}

function chip(label: string): string {
  const found = screen.getByText(label, { selector: "[data-chip] > :first-child" });
  return found.nextElementSibling?.textContent ?? "";
}

describe("ItemDetailPage", () => {
  it("mostra nome, tag, tamanho e EAN, quantidade, status e chips; foca o titulo", async () => {
    await setup();
    const heading = screen.getByRole("heading", { level: 2, name: "Café em grãos" });
    expect(document.activeElement).toBe(heading);
    expect(screen.getByText("Despensa")).toBeTruthy();
    expect(screen.getByText("Torrado 1 kg · EAN 7891234567890")).toBeTruthy();
    expect(stepper().getByText("2")).toBeTruthy();
    expect(stepper().getByText("em dia")).toBeTruthy();
    expect(chip("Mínimo")).toBe("2 pct");
    expect(chip("Validade")).toBe("Sem data");
    expect(chip("Acaba em")).toBe("Sem dados");
  });

  it("tag com local; categoria apagada vira Sem categoria", async () => {
    await setup({
      prepare: async (session, item) => {
        const armario = session.data.value.locations.find((l) => l.name === "Armário");
        const bebidas = await session.run((repo) => repo.upsertCategory("Bebidas"));
        await session.run((repo) =>
          repo.updateItem(item.id, { categoryId: bebidas.id, locationId: armario?.id ?? null }),
        );
        await session.run((repo) => repo.removeCategory(bebidas.id));
      },
    });
    expect(screen.getByText("Sem categoria · Armário")).toBeTruthy();
  });

  it("sem tamanho nem EAN a linha some; so tamanho fica sem EAN", async () => {
    await setup({ draft: { size: "", ean: null } });
    expect(screen.queryByText(/EAN/)).toBeNull();
    cleanup();
    await setup({ draft: { ean: null } });
    expect(screen.getByText("Torrado 1 kg")).toBeTruthy();
  });

  it("Usar um grava use, mostra o toast e Desfazer apaga o movimento", async () => {
    const { moves } = await setup();
    fireEvent.click(useButton());
    await waitFor(() => expect(moves("use")).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Usou 1 pct")).toBeTruthy());
    expect(stepper().getByText("1")).toBeTruthy();
    expect(stepper().getByText("abaixo do mínimo")).toBeTruthy();

    const undo = screen.getByRole("button", { name: "Desfazer" });
    undo.focus();
    fireEvent.click(undo);
    await waitFor(() => expect(moves("use")[0]?.deletedAt).not.toBeNull());
    await waitFor(() => expect(stepper().getByText("2")).toBeTruthy());
    // O botao do toast some; o foco nao fica perdido no body.
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })),
    );
  });

  it("depois de dois toques rapidos, Desfazer apaga so o ultimo movimento", async () => {
    const { moves } = await setup();
    fireEvent.click(useButton());
    fireEvent.click(useButton());
    await waitFor(() => expect(moves("use")).toHaveLength(2));
    await waitFor(() => expect(stepper().getByText("0")).toBeTruthy());
    const [older, newer] = [...moves("use")].sort((a, b) => (a.id < b.id ? -1 : 1));

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(stepper().getByText("1")).toBeTruthy());
    const byId = (id: string | undefined) => moves("use").find((m) => m.id === id);
    expect(byId(newer?.id)?.deletedAt).not.toBeNull();
    expect(byId(older?.id)?.deletedAt).toBeNull();
  });

  it("sair do Detalhe com toque em voo nao quebra e o toast ainda aparece", async () => {
    const { ctx, moves, view } = await setup();
    fireEvent.click(useButton());
    view.unmount();
    await waitFor(() => expect(moves("use")).toHaveLength(1));
    await waitFor(() => expect(ctx.toast.current.value?.text).toBe("Usou 1 pct"));
    expect(ctx.toast.current.value?.action?.label).toBe("Desfazer");
  });

  it("Adicionar um grava restock sem preco", async () => {
    const { session, moves } = await setup();
    fireEvent.click(addButton());
    await waitFor(() => expect(moves("restock")).toHaveLength(1));
    await waitFor(() => expect(screen.getByText("Guardou 1 pct")).toBeTruthy());
    expect(stepper().getByText("3")).toBeTruthy();
    expect(session.data.value.prices).toHaveLength(0);
  });

  it("com 0, Usar um fica desabilitado e o status e esgotado", async () => {
    await setup({ qty: 0 });
    expect(useButton().disabled).toBe(true);
    expect(stepper().getByText("0")).toBeTruthy();
    expect(stepper().getByText("esgotado")).toBeTruthy();
    expect(chip("Acaba em")).toBe("Acabou");
  });

  it("toques rapidos: dois usos levam a 0 e o terceiro nao passa de 0", async () => {
    const { session, item, moves } = await setup();
    useButton().focus();
    fireEvent.click(useButton());
    fireEvent.click(useButton());
    // O pendente ja conta: o botao desabilita antes de as escritas terminarem.
    expect(useButton().disabled).toBe(true);
    fireEvent.click(useButton());
    // O foco nao cai no body quando o botao usado desabilita.
    expect(document.activeElement).toBe(addButton());
    await waitFor(() => expect(moves("use")).toHaveLength(2));
    await waitFor(() => expect(stepper().getByText("0")).toBeTruthy());
    const total = session.data.value.movements
      .filter((m) => m.itemId === item.id && m.deletedAt === null)
      .reduce((sum, m) => sum + m.delta, 0);
    expect(total).toBe(0);
  });

  it("falha mostra o erro abaixo do stepper; um toque seguinte com sucesso limpa", async () => {
    let fail = true;
    const { moves } = await setup({
      overrides: (session) => {
        const real = createItemStore(session);
        return {
          items: {
            ...real,
            step: (id, dir) =>
              fail ? Promise.reject(new Error("Disco cheio.")) : real.step(id, dir),
          },
        };
      },
    });
    fireEvent.click(useButton());
    expect((await screen.findByRole("alert")).textContent).toBe("Disco cheio.");
    expect(stepper().getByText("2")).toBeTruthy();
    fail = false;
    fireEvent.click(useButton());
    await waitFor(() => expect(moves("use")).toHaveLength(1));
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  });

  it("so a falha do ultimo toque aparece", async () => {
    let rejectFirst: (cause: Error) => void = () => {};
    let resolveSecond: (m: Movement) => void = () => {};
    const { item } = await setup({
      overrides: (session) => {
        const real = createItemStore(session);
        let calls = 0;
        return {
          items: {
            ...real,
            step: () => {
              calls += 1;
              return calls === 1
                ? new Promise<Movement>((_, reject) => {
                    rejectFirst = reject;
                  })
                : new Promise<Movement>((resolve) => {
                    resolveSecond = resolve;
                  });
            },
          },
        };
      },
    });
    fireEvent.click(addButton());
    fireEvent.click(addButton());
    // Fora de ordem de proposito: a falha velha chega depois do sucesso novo.
    resolveSecond({ id: "m2", itemId: item.id, delta: 1, reason: "restock" } as Movement);
    await waitFor(() => expect(screen.getByText("Guardou 1 pct")).toBeTruthy());
    rejectFirst(new Error("Velho."));
    await waitFor(() => expect(stepper().getByText("2")).toBeTruthy());
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("sem consumo: legenda e dica; com tres usos: barras e acaba em", async () => {
    await setup();
    expect(screen.getByText("Sem histórico ainda")).toBeTruthy();
    expect(screen.getByText(/Toque em − quando usar uma unidade/)).toBeTruthy();
    expect(screen.queryByRole("img")).toBeNull();
    cleanup();

    await setup({
      qty: 5,
      prepare: async (session, item, clock) => {
        await session.run((repo) => repo.useItem(item.id, 1));
        clock.advance(8 * DAY_MS);
        await session.run((repo) => repo.useItem(item.id, 1));
        clock.advance(8 * DAY_MS);
        await session.run((repo) => repo.useItem(item.id, 1));
      },
    });
    expect(screen.getByText("1 pct a cada ~8 dias")).toBeTruthy();
    const chart = screen.getByRole("img", {
      name: "Dias por unidade, do mais antigo ao mais novo: 8, 8",
    });
    expect(within(chart).getAllByText("8d")).toHaveLength(2);
    expect(chip("Acaba em")).toBe("~2 semanas");
    expect(screen.queryByText(/Toque em −/)).toBeNull();
  });

  it("Ultimo preco aparece so com preco gravado", async () => {
    await setup();
    expect(screen.queryByText("Último preço")).toBeNull();
    cleanup();

    await setup({
      prepare: async (session, item) => {
        await session.run((repo) => repo.restock(item.id, 1, 4290));
      },
    });
    expect(screen.getByRole("heading", { level: 4, name: "Último preço" })).toBeTruthy();
    expect(
      screen.getByText((text) => text.replaceAll(String.fromCharCode(160), " ") === "R$ 42,90"),
    ).toBeTruthy();
  });

  it("foto permitida vira img no hero com washed", async () => {
    await setup({ draft: { photo: "data:image/webp;base64,AAA" } });
    const img = document.querySelector("img");
    expect(img?.getAttribute("src")).toBe("data:image/webp;base64,AAA");
    expect(img?.classList.contains("washed")).toBe(true);
    expect(img?.getAttribute("alt")).toBe("");
  });

  it("item apagado em outro lugar: a tela volta", async () => {
    const { session, item, history } = await setup();
    await session.run((repo) => repo.deleteItem(item.id));
    await waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });

  it("Editar empilha item-edit e Voltar volta", async () => {
    const { ctx, item, history } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    expect(ctx.router.top.value).toEqual({ kind: "item-edit", id: item.id });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(history.back).toHaveBeenCalledTimes(1);
  });

  describe("lista de compras", () => {
    const ADD = "Adicionar à lista de compras";
    const REMOVE = "Tirar da lista de compras";
    const PILL = "Na lista de compras · abaixo do mínimo";
    const marks = (session: Session, itemId: string) =>
      session.data.value.listMarks.filter((m) => m.itemId === itemId && m.deletedAt === null);
    const pinFirst = async (session: Session, item: Item) => {
      await session.run((repo) => repo.markItem(item.id, { pinned: 1 }));
    };

    it("fixa pelo botao, o foco fica no botao que vira Tirar e o Desfazer devolve", async () => {
      const { session, item } = await setup({ qty: 5 });
      const add = screen.getByRole("button", { name: ADD });
      add.focus();
      fireEvent.click(add);
      const remove = await screen.findByRole("button", { name: REMOVE });
      expect(await screen.findByText("Café em grãos entrou na lista")).toBeTruthy();
      const [mark] = marks(session, item.id);
      expect(mark?.pinned).toBe(1);
      expect(mark?.pinnedBy).toBe(session.data.value.members.find((m) => m.name === ANA.name)?.id);
      expect(mark?.pinnedBy).toBeTruthy();
      expect(document.activeElement).toBe(remove);
      // Como a pessoa: o foco esta no Desfazer do toast, que some ao fechar.
      const undo = screen.getByRole("button", { name: "Desfazer" });
      undo.focus();
      fireEvent.click(undo);
      await screen.findByRole("button", { name: ADD });
      expect(marks(session, item.id)).toHaveLength(0);
      await waitFor(() =>
        expect(document.activeElement).toBe(screen.getByRole("heading", { level: 2 })),
      );
    });

    it("tirar da lista apaga a marca e o Desfazer devolve fixado", async () => {
      const { session, item } = await setup({ qty: 5, prepare: pinFirst });
      fireEvent.click(screen.getByRole("button", { name: REMOVE }));
      await screen.findByRole("button", { name: ADD });
      expect(await screen.findByText("Café em grãos saiu da lista")).toBeTruthy();
      expect(marks(session, item.id)).toHaveLength(0);
      fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
      await screen.findByRole("button", { name: REMOVE });
      expect(marks(session, item.id)[0]?.pinned).toBe(1);
    });

    it("abaixo do minimo: pilula sem botao; com a lista automatica desligada volta o botao", async () => {
      const { session } = await setup({ qty: 1 });
      expect(screen.getByText(PILL)).toBeTruthy();
      expect(screen.queryByRole("button", { name: ADD })).toBeNull();
      await session.run((repo) => repo.setPref("autoList", false));
      await screen.findByRole("button", { name: ADD });
      expect(screen.queryByText(PILL)).toBeNull();
    });

    it("min 0 com 0 un: pode ser pedido", async () => {
      await setup({ qty: 0, draft: { min: 0 } });
      expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    });

    it("dois cliques seguidos gravam uma vez", async () => {
      const { session, item } = await setup({ qty: 5 });
      const button = screen.getByRole("button", { name: ADD });
      fireEvent.click(button);
      fireEvent.click(button);
      await screen.findByRole("button", { name: REMOVE });
      const all = session.data.value.listMarks.filter((m) => m.itemId === item.id);
      expect(all).toHaveLength(1);
      expect(all[0]?.pinned).toBe(1);
    });

    it("o + do stepper tira o item fixado da lista", async () => {
      const { session, item } = await setup({ qty: 5, prepare: pinFirst });
      fireEvent.click(addButton());
      await screen.findByRole("button", { name: ADD });
      expect(marks(session, item.id)).toHaveLength(0);
    });

    it("quando o item cai abaixo do minimo o botao vira pilula e o foco vai a ela", async () => {
      await setup({ qty: 2 });
      screen.getByRole("button", { name: ADD }).focus();
      fireEvent.click(useButton());
      const pill = await screen.findByText(PILL);
      // O foco estava no botao que sumiu; a pilula (tabIndex -1) o recebe.
      await waitFor(() => expect(document.activeElement).toBe(pill));
    });

    it("erro do botao aparece abaixo dele e o botao reabre", async () => {
      const { ctx } = await setup({ qty: 5 });
      ctx.shopping.pin = () => Promise.reject(new Error("Sem espaço."));
      fireEvent.click(screen.getByRole("button", { name: ADD }));
      expect((await screen.findByRole("alert")).textContent).toContain("Sem espaço.");
      expect(screen.getByRole("button", { name: ADD })).toBeTruthy();
    });
  });
});
