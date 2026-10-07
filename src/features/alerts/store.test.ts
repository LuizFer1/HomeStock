import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createAlertsStore } from "./store";

async function setup() {
  const { session } = await openTestSession({ member: ANA });
  return { session, store: createAlertsStore(session) };
}

describe("AlertsStore", () => {
  it("resolve publica a linha e devolve so as chaves que gravou", async () => {
    const { session, store } = await setup();
    expect(await store.resolve(["low:X:start"])).toEqual(["low:X:start"]);
    expect(session.data.value.alertStates.map((r) => r.key)).toEqual(["low:X:start"]);
    // Ja resolvida (talvez por outro morador): nada gravado, nada a desfazer.
    expect(await store.resolve(["low:X:start", "act:B"])).toEqual(["act:B"]);
    expect(await store.resolve(["low:X:start"])).toEqual([]);
  });

  it("resolve e reopen sem await terminam na ordem", async () => {
    const { session, store } = await setup();
    const first = store.resolve(["low:X:start"]);
    const second = store.reopen(["low:X:start"]);
    await Promise.all([first, second]);
    const [row] = session.data.value.alertStates;
    expect(row?.deletedAt).not.toBeNull();
  });

  it("chave invalida rejeita e a fila segue", async () => {
    const { session, store } = await setup();
    await expect(store.resolve(["x y"])).rejects.toThrow();
    await store.resolve(["act:A"]);
    expect(session.data.value.alertStates).toHaveLength(1);
  });

  it("returnFocus nasce vazio", async () => {
    const { store } = await setup();
    expect(store.returnFocus.value).toBeNull();
  });
});
