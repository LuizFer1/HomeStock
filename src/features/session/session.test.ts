import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { openRepository, type Repository } from "../../data/repository";
import { openTestDb, seededRandom, testClock } from "../../data/test-db.fake";
import { seedCategories } from "../../domain/defaults/seeds";
import { DEFAULT_PREFS } from "../../domain/model/prefs";
import { createSession, EMPTY_SNAPSHOT } from "./session";
import { ANA, openTestSession } from "./test-session.fake";

function newSession(db = openTestDb()) {
  return createSession({
    db,
    now: testClock(),
    randomChunk: seededRandom(1),
    today: () => "2026-10-06",
  });
}

describe("createSession", () => {
  it("antes do init esta carregando e vazia", () => {
    const session = newSession();
    expect(session.status.value).toBe("loading");
    expect(session.data.value).toBe(EMPTY_SNAPSHOT);
    expect(session.error.value).toBeNull();
  });

  it("init publica o disco: sementes, sem morador e preferencias padrao", async () => {
    const session = newSession();
    await session.init();
    expect(session.status.value).toBe("ready");
    expect(session.data.value.categories.map((c) => c.name).sort()).toEqual(
      seedCategories()
        .map((c) => c.name)
        .sort(),
    );
    expect(session.localMemberId.value).toBeNull();
    expect(session.localMember.value).toBeNull();
    expect(session.prefs.value).toEqual(DEFAULT_PREFS);
  });

  it("falha ao abrir o banco vira status de erro sem relancar", async () => {
    const db = openTestDb();
    vi.spyOn(db.meta, "get").mockRejectedValue(new Error("quota"));
    const session = newSession(db);
    await expect(session.init()).resolves.toBeUndefined();
    expect(session.status.value).toBe("error");
    expect(session.error.value).toBe("quota");
  });

  it("run publica o morador local criado", async () => {
    const { session } = await openTestSession();
    const member = await session.run((r) => r.createLocalMember(ANA));
    expect(session.localMemberId.value).toBe(member.id);
    expect(session.localMember.value?.name).toBe("Ana");
  });

  it("depois do onboarding, as escritas levam o morador local como autor", async () => {
    const { session } = await openTestSession({ member: ANA });
    const category = await session.run((r) => r.upsertCategory("Bebidas"));
    expect(category.authorId).toBe(session.localMemberId.value);
    expect(session.data.value.categories.some((c) => c.name === "Bebidas")).toBe(true);
  });

  it("run com comando que lanca relanca e nao muda o estado", async () => {
    const { session } = await openTestSession();
    const before = session.data.value;
    await expect(
      session.run(async () => {
        throw new Error("recusado");
      }),
    ).rejects.toThrow("recusado");
    expect(session.data.value).toBe(before);
  });

  it("setPref reflete nas preferencias", async () => {
    const { session } = await openTestSession({ member: ANA });
    await session.run((r) => r.setPref("alertLow", false));
    expect(session.prefs.value.alertLow).toBe(false);
  });

  it("uma leitura velha que termina depois nao cobre a mais nova", async () => {
    const { session } = await openTestSession();
    let repo: Repository | undefined;
    await session.run(async (r) => {
      repo = r;
    });
    if (repo === undefined) throw new Error("repositorio nao capturado");
    const stale = await repo.snapshot();
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    vi.spyOn(repo, "snapshot").mockImplementationOnce(async () => {
      await gate;
      return stale;
    });

    const first = session.reload();
    await repo.upsertCategory("Bebidas");
    await session.reload();
    expect(session.data.value.categories.some((c) => c.name === "Bebidas")).toBe(true);

    release();
    await first;
    expect(session.data.value.categories.some((c) => c.name === "Bebidas")).toBe(true);
  });

  it("morador criado em outra aba entre as leituras nao publica id sem linha", async () => {
    const { db, session } = await openTestSession();
    let repo: Repository | undefined;
    await session.run(async (r) => {
      repo = r;
    });
    if (repo === undefined) throw new Error("repositorio nao capturado");
    const otherTab = await openRepository({
      db,
      now: testClock(1_800_000_000_000),
      randomChunk: seededRandom(2),
      currentMemberId: () => null,
      today: () => "2026-10-06",
    });
    const readId = repo.localMemberId;
    vi.spyOn(repo, "localMemberId").mockImplementationOnce(async () => {
      // A outra aba conclui o onboarding no meio do reload desta.
      await otherTab.createLocalMember(ANA);
      return readId();
    });

    await session.reload();
    expect(session.localMemberId.value).not.toBeNull();
    expect(session.localMember.value?.name).toBe("Ana");
  });

  it("run antes do init rejeita", async () => {
    const session = newSession();
    await expect(session.run(async () => 1)).rejects.toThrow("Sessao nao inicializada");
  });

  it("reload antes do init nao faz nada", async () => {
    const session = newSession();
    await session.reload();
    expect(session.status.value).toBe("loading");
    expect(session.data.value).toBe(EMPTY_SNAPSHOT);
  });
});
