import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testContext } from "../../app-context.fake";
import { testClock } from "../../data/test-db.fake";
import { isAlive } from "../../domain/model/base";
import { cafe } from "../../domain/model/item.fake";
import { quantities } from "../../domain/projections/stock";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { putRafa, putRafaMovement, putRafaRequest } from "./activity.fake";
import { AlertsPage } from "./alerts-page";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const IOGURTE = "Iogurte natural";
const iogurte = () =>
  cafe({ name: IOGURTE, unit: "un", min: 0, expiresAt: "2026-10-07", ean: null });

function mount(session: Session) {
  const made = testContext(session);
  const view = render(
    <>
      <AlertsPage ctx={made.ctx} />
      <ToastView store={made.ctx.toast} raised={false} />
    </>,
  );
  return { ...made, view };
}

async function setup(seed: (session: Session) => Promise<void> = async () => {}) {
  const { db, session } = await openTestSession({
    member: ANA,
    now: testClock(Date.UTC(2026, 9, 6, 12)),
  });
  await seed(session);
  return { db, session, ...mount(session) };
}

const seedCafeIogurte = async (session: Session, iogurteQty = 2) => {
  await session.run((r) => r.createItem(cafe(), 1));
  await session.run((r) => r.createItem(iogurte(), iogurteQty));
};

function idOf(session: Session, name: string): string {
  const item = session.data.value.items.find((i) => i.name === name);
  if (item === undefined) throw new Error(`${name} nao achado`);
  return item.id;
}

const USE = `Marcar como usado, ${IOGURTE} vence amanhã`;
const li = (key: string) => document.querySelector<HTMLElement>(`[data-alert-key="${key}"]`);

describe("AlertsPage", () => {
  it("lista cafe e iogurte em Hoje com a contagem de pendentes", async () => {
    await setup(seedCafeIogurte);
    expect(screen.getByRole("heading", { level: 1, name: "Alertas" })).toBeTruthy();
    expect(screen.getByText("2 pendentes")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Hoje" })).toBeTruthy();
    expect(screen.getByText("Café em grãos abaixo do mínimo")).toBeTruthy();
    expect(screen.getByText(/já está na lista/)).toBeTruthy();
    expect(screen.getByText(`${IOGURTE} vence amanhã`)).toBeTruthy();
  });

  it("Marcar como usado grava o uso, resolve, avisa, foca e desfaz", async () => {
    const { session } = await setup(seedCafeIogurte);
    const id = idOf(session, IOGURTE);
    fireEvent.click(screen.getByRole("button", { name: USE }));
    await waitFor(() => expect(screen.getByText("1 pendente")).toBeTruthy());
    expect(quantities(session.data.value.movements).get(id)).toBe(1);
    const card = li(`exp:${id}:2026-10-07`);
    expect(card?.className).toContain("opacity-[0.55]");
    expect(within(card as HTMLElement).getByText("Resolvido")).toBeTruthy();
    await waitFor(() => expect(screen.getByText("Usou 1 un de Iogurte natural")).toBeTruthy());
    await waitFor(() => expect(document.activeElement).toBe(card));

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(screen.getByText("2 pendentes")).toBeTruthy());
    expect(quantities(session.data.value.movements).get(id)).toBe(2);
    expect(session.data.value.alertStates.every((r) => !isAlive(r))).toBe(true);
  });

  it("o Desfazer reabre apenas as chaves que o resolve gravou", async () => {
    const { session, ctx } = await setup(seedCafeIogurte);
    const id = idOf(session, IOGURTE);
    const key = `exp:${id}:2026-10-07`;
    const reopen = vi.spyOn(ctx.alerts, "reopen");
    // Outro morador resolve no meio do toque: a tela ainda via o alerta pendente,
    // mas o resolve da acao nao regrava a chave e devolve [].
    const original = ctx.alerts.resolve;
    ctx.alerts.resolve = async (keys) => {
      await original([key]);
      return original(keys);
    };
    fireEvent.click(screen.getByRole("button", { name: USE }));
    await waitFor(() => screen.getByRole("button", { name: "Desfazer" }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(reopen).toHaveBeenCalled());
    expect(reopen.mock.calls[0]?.[0]).toEqual([]);
    expect(session.data.value.alertStates.some((r) => r.key === key && isAlive(r))).toBe(true);
  });

  it("usar a ultima unidade some com o alerta e leva o foco ao titulo", async () => {
    await setup((s) => seedCafeIogurte(s, 1));
    fireEvent.click(screen.getByRole("button", { name: USE }));
    await waitFor(() => expect(screen.queryByText(`${IOGURTE} vence amanhã`)).toBeNull());
    await waitFor(() =>
      expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 })),
    );
  });

  it("dois cliques seguidos gravam um movimento so", async () => {
    const { session } = await setup(seedCafeIogurte);
    const id = idOf(session, IOGURTE);
    const button = screen.getByRole("button", { name: USE });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("1 pendente")).toBeTruthy());
    expect(quantities(session.data.value.movements).get(id)).toBe(1);
  });

  it("Adicionar a lista fixa o item, resolve e o Desfazer solta a marca", async () => {
    const { session } = await setup(async (s) => {
      await s.run((r) => r.createItem(cafe(), 1));
      await s.run((r) => r.setPref("autoList", false));
    });
    const id = idOf(session, "Café em grãos");
    const name = "Adicionar à lista, Café em grãos abaixo do mínimo";
    fireEvent.click(screen.getByRole("button", { name }));
    await waitFor(() => expect(screen.getByText("Café em grãos entrou na lista")).toBeTruthy());
    const mark = () => session.data.value.listMarks.find((m) => m.itemId === id && isAlive(m));
    expect(mark()?.pinned).toBe(1);
    expect(screen.getByText("Resolvido")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(screen.getByText("1 pendente")).toBeTruthy());
    expect(mark()).toBeUndefined();
  });

  it("Ver item resolve, empilha o Detalhe e guarda o foco de volta", async () => {
    const { session, ctx } = await setup(seedCafeIogurte);
    const id = idOf(session, "Café em grãos");
    fireEvent.click(
      screen.getByRole("button", { name: "Ver item, Café em grãos abaixo do mínimo" }),
    );
    await waitFor(() => expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "item", id }));
    expect(session.data.value.alertStates).toHaveLength(1);
    expect(ctx.alerts.returnFocus.value).toMatch(/^low:/);
  });

  it("remontar com returnFocus foca o cartao e zera o sinal", async () => {
    const { session, ctx } = await setup(seedCafeIogurte);
    const key = `exp:${idOf(session, IOGURTE)}:2026-10-07`;
    cleanup();
    ctx.alerts.returnFocus.value = key;
    render(<AlertsPage ctx={ctx} />);
    expect(document.activeElement).toBe(li(key));
    expect(ctx.alerts.returnFocus.value).toBeNull();
  });

  it("atividade de Rafa: Ver item no uso e Entendi no pedido, com Desfazer", async () => {
    const { db, session } = await setup(async (s) => {
      await s.run((r) => r.createItem(cafe({ min: 0 }), 5));
    });
    await putRafa(db);
    const cafeId = idOf(session, "Café em grãos");
    await putRafaMovement(db, cafeId, -1, new Date(2026, 9, 6, 9).toISOString());
    await putRafaRequest(db, "Banana prata", new Date(2026, 9, 5, 19, 40).toISOString());
    await session.reload();
    await waitFor(() => screen.getByText("Rafa usou 1 pct de Café em grãos"));
    expect(
      screen.getByRole("button", { name: "Ver item, Rafa usou 1 pct de Café em grãos" }),
    ).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Esta semana" })).toBeTruthy();
    expect(screen.getByText("Banana prata · ontem, 19:40")).toBeTruthy();

    const entendi = "Entendi, Rafa adicionou 1 item à lista";
    fireEvent.click(screen.getByRole("button", { name: entendi }));
    await waitFor(() => expect(screen.getByText("Alerta resolvido")).toBeTruthy());
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => screen.getByRole("button", { name: entendi }));
  });

  it("preferencias: alertLow desligado tira o cafe; tudo desligado avisa", async () => {
    const { session } = await setup(seedCafeIogurte);
    await session.run((r) => r.setPref("alertLow", false));
    await waitFor(() => expect(screen.queryByText("Café em grãos abaixo do mínimo")).toBeNull());
    await session.run((r) => r.setPref("alertExpiring", false));
    await session.run((r) => r.setPref("alertActivity", false));
    await waitFor(() =>
      expect(screen.getByText("Os alertas estão desligados nos Ajustes.")).toBeTruthy(),
    );
  });

  it("sem itens: Nenhum alerta por aqui e Nada pendente", async () => {
    await setup();
    expect(screen.getByText("Nenhum alerta por aqui.")).toBeTruthy();
    expect(screen.getByText("Nada pendente")).toBeTruthy();
  });

  it("Voltar chama o history.back", async () => {
    const { history, ctx } = await setup();
    ctx.router.push({ kind: "alerts" });
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(history.back).toHaveBeenCalledTimes(1);
  });
});
