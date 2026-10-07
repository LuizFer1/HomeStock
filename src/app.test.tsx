import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./app";
import { fakeUpdate, testContext } from "./app-context.fake";
import { openTestDb, seededRandom, testClock } from "./data/test-db.fake";
import { createOnboardingStore } from "./features/onboarding/store";
import { createSession, type Session } from "./features/session/session";
import { ANA, openTestSession } from "./features/session/test-session.fake";
import { createRouter } from "./features/shell/route";

function setup(session: Session, ready = false) {
  const { ctx, history } = testContext(session, { update: fakeUpdate(ready) });
  render(<App ctx={ctx} onboarding={createOnboardingStore(session)} />);
  return { router: ctx.router, history };
}

/** Historico que nao dispara popstate sozinho: o teste anda a pilha passo a passo. */
function setupManualHistory(session: Session) {
  const history = { pushState: vi.fn(), back: vi.fn(), go: vi.fn() };
  const router = createRouter(history);
  const { ctx } = testContext(session, { router });
  render(<App ctx={ctx} onboarding={createOnboardingStore(session)} />);
  return { router, history };
}

function idleSession(): Session {
  return createSession({
    db: openTestDb(),
    now: testClock(),
    randomChunk: seededRandom(1),
    today: () => "2026-10-06",
  });
}

afterEach(cleanup);

describe("App", () => {
  it("abre no Inicio com a sessao pronta", async () => {
    const { session } = await openTestSession({ member: ANA });
    setup(session);
    expect(screen.getByRole("heading", { name: "Início" })).toBeTruthy();
  });

  it("troca de tela pela tab bar", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router } = setup(session);
    fireEvent.click(screen.getByRole("button", { name: "Estoque" }));
    expect(router.tab.value).toBe("stock");
    expect(await screen.findByRole("heading", { name: "Estoque" })).toBeTruthy();
  });

  it("mostra o aviso de versao nova", async () => {
    const { session } = await openTestSession({ member: ANA });
    setup(session, true);
    expect(screen.getByText("Nova versão disponível")).toBeTruthy();
  });

  it("enquanto carrega nao mostra a tab bar", () => {
    setup(idleSession());
    expect(screen.queryByRole("button", { name: "Estoque" })).toBeNull();
    expect(document.querySelector("[aria-busy='true']")).not.toBeNull();
  });

  it("falha ao abrir o banco mostra o alerta com o motivo", async () => {
    const db = openTestDb();
    vi.spyOn(db.meta, "get").mockRejectedValue(new Error("quota"));
    const session = createSession({
      db,
      now: testClock(),
      randomChunk: seededRandom(1),
      today: () => "2026-10-06",
    });
    await session.init();
    setup(session);
    expect(screen.getByRole("alert").textContent).toContain(
      "Não foi possível abrir o armazenamento deste aparelho.",
    );
    expect(screen.getByText("quota")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Estoque" })).toBeNull();
  });

  it("tela empilhada desconhecida volta", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router, history } = setup(session);
    router.push({ kind: "nada" });
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
  });

  it("duas telas desconhecidas empilhadas voltam as duas", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router, history } = setupManualHistory(session);
    router.push({ kind: "nada" });
    router.push({ kind: "outra" });
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(1));
    router.onPopState();
    await vi.waitFor(() => expect(history.back).toHaveBeenCalledTimes(2));
    router.onPopState();
    expect(router.stack.value).toEqual([]);
  });

  it("sem morador mostra o wizard sem tab bar e completar abre a casca", async () => {
    const { session } = await openTestSession();
    setup(session);
    expect(screen.getByText("Como podemos te chamar?")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Estoque" })).toBeNull();
    fireEvent.input(screen.getByLabelText("Seu nome"), { target: { value: "Ana" } });
    for (let i = 0; i < 3; i++) {
      fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    }
    fireEvent.click(screen.getByRole("button", { name: "Entrar no HomeStock" }));
    expect(await screen.findByRole("heading", { name: "Início" })).toBeTruthy();
  });

  it("durante o onboarding nao mostra o aviso de versao nova", async () => {
    const { session } = await openTestSession();
    setup(session, true);
    expect(screen.getByText("Como podemos te chamar?")).toBeTruthy();
    expect(screen.queryByText("Nova versão disponível")).toBeNull();
  });

  it("o avatar do Inicio abre os Ajustes e Editar abre o wizard de edicao", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router } = setup(session);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    const field = (await screen.findByLabelText("Seu nome")) as HTMLInputElement;
    expect(field.value).toBe("Ana");

    fireEvent.input(field, { target: { value: "Ana Maria" } });
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await vi.waitFor(() => expect(session.localMember.value?.name).toBe("Ana Maria"));
    // O `back` do salvar ja desempilhou (o historico falso dispara o popstate).
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeTruthy();
    expect(screen.getAllByText("Ana Maria").length).toBeGreaterThan(0);
    // Voltar do sistema, sem toque na tela.
    router.onPopState();
    expect(await screen.findByRole("button", { name: "Ajustes" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "Ana Maria" })).toBeTruthy();
  });

  it("sem a linha do morador local o botao Ajustes continua, com inicial neutra", async () => {
    const { db, session } = await openTestSession({ member: ANA });
    await db.members.clear();
    await session.reload();
    expect(session.localMember.value).toBeNull();
    const { router } = setup(session);
    const button = screen.getByRole("button", { name: "Ajustes" });
    expect(button.querySelector("img")).toBeNull();
    expect(button.textContent).toBe("?");
    fireEvent.click(button);
    expect(router.stack.value.map((s) => s.kind)).toEqual(["settings"]);
  });

  it("voltar do sistema durante o salvar nao desempilha duas vezes", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router, history } = setup(session);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
    await screen.findByLabelText("Seu nome");
    // Segura a gravacao ate o teste liberar.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const realRun = session.run;
    session.run = (async (command) => {
      await gate;
      return realRun(command);
    }) as typeof session.run;
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    router.onPopState();
    expect(router.stack.value.map((s) => s.kind)).toEqual(["settings"]);
    release();
    await vi.waitFor(() => expect(session.localMember.value?.name).toBe("Ana"));
    // O heading de Ajustes so volta quando o salvar terminou e a tela reagiu.
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeTruthy();
    await act(async () => {
      await Promise.resolve();
    });
    expect(history.back).not.toHaveBeenCalled();
  });

  it("Categorias e locais abre a tela de lugares e Voltar volta aos Ajustes", async () => {
    const { session } = await openTestSession({ member: ANA });
    const { router, history } = setup(session);
    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    fireEvent.click(await screen.findByRole("button", { name: /Categorias e locais/ }));
    expect(await screen.findByRole("heading", { name: "Categorias e locais" })).toBeTruthy();
    expect(router.stack.value.map((s) => s.kind)).toEqual(["settings", "places"]);

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(history.back).toHaveBeenCalled();
    expect(await screen.findByRole("heading", { name: "Ajustes" })).toBeTruthy();
  });
});
