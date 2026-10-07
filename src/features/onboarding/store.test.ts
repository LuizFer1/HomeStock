import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { openTestDb, seededRandom, testClock } from "../../data/test-db.fake";
import { createSession } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createOnboardingStore } from "./store";

describe("createOnboardingStore", () => {
  it("needsOnboarding e falso carregando e verdadeiro depois do init", async () => {
    const session = createSession({
      db: openTestDb(),
      now: testClock(),
      randomChunk: seededRandom(1),
      today: () => "2026-10-06",
    });
    const store = createOnboardingStore(session);
    expect(store.needsOnboarding.value).toBe(false);
    await session.init();
    expect(store.needsOnboarding.value).toBe(true);
  });

  it("complete grava o morador e encerra o onboarding", async () => {
    const { session } = await openTestSession();
    const store = createOnboardingStore(session);
    await store.complete(ANA);
    expect(store.needsOnboarding.value).toBe(false);
    expect(session.localMember.value?.name).toBe("Ana");
  });

  it("duas chamadas seguidas gravam um morador so", async () => {
    const { session } = await openTestSession();
    const store = createOnboardingStore(session);
    await Promise.all([store.complete(ANA), store.complete(ANA)]);
    expect(session.data.value.members.length).toBe(1);
  });

  it("falha mantem o onboarding e permite nova tentativa", async () => {
    const { session } = await openTestSession();
    const store = createOnboardingStore(session);
    await expect(store.complete({ ...ANA, name: "  " })).rejects.toThrow();
    expect(store.needsOnboarding.value).toBe(true);
    await store.complete(ANA);
    expect(store.needsOnboarding.value).toBe(false);
  });
});
