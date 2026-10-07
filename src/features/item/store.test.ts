import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { isAlive } from "../../domain/model/base";
import { cafe } from "../../domain/model/item.fake";
import { quantityOf } from "../../domain/projections/stock";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createItemStore } from "./store";

describe("createItemStore", () => {
  it("remove apaga e restore devolve com a mesma quantidade", async () => {
    const { session } = await openTestSession({ member: ANA });
    const item = await session.run((repo) => repo.createItem(cafe(), 3));
    const store = createItemStore(session);
    const alive = () => session.data.value.items.find((i) => i.id === item.id && isAlive(i));

    await store.remove(item.id);
    expect(alive()).toBeUndefined();

    await store.restore(item.id);
    expect(alive()?.name).toBe("Café em grãos");
    expect(quantityOf(item.id, session.data.value.movements)).toBe(3);
  });
});

describe("step e undo", () => {
  async function setup() {
    const { session } = await openTestSession({ member: ANA });
    const item = await session.run((repo) => repo.createItem(cafe(), 2));
    const store = createItemStore(session);
    const moves = () =>
      session.data.value.movements.filter((m) => m.itemId === item.id && m.reason !== "initial");
    return { session, item, store, moves };
  }

  it("-1 grava use e +1 grava restock sem preco", async () => {
    const { session, item, store, moves } = await setup();
    const used = await store.step(item.id, -1);
    expect(used).toMatchObject({ reason: "use", delta: -1 });
    const added = await store.step(item.id, 1);
    expect(added).toMatchObject({ reason: "restock", delta: 1 });
    expect(moves().map((m) => m.reason)).toEqual(["use", "restock"]);
    expect(session.data.value.prices).toHaveLength(0);
  });

  it("tres toques sem esperar gravam tres movimentos na ordem", async () => {
    const { session, item, store, moves } = await setup();
    const all = await Promise.all([
      store.step(item.id, -1),
      store.step(item.id, 1),
      store.step(item.id, -1),
    ]);
    expect(all.map((m) => m.reason)).toEqual(["use", "restock", "use"]);
    // A ordem de gravacao segue o id (ULID monotonico) e o createdAt.
    const sorted = [...moves()].sort((a, b) => (a.id < b.id ? -1 : 1));
    expect(sorted.map((m) => m.id)).toEqual(all.map((m) => m.id));
    expect(quantityOf(item.id, session.data.value.movements)).toBe(1);
  });

  it("uma falha na fila nao trava os toques seguintes", async () => {
    const { item, store } = await setup();
    await expect(store.step("nao-existe", -1)).rejects.toThrow();
    await expect(store.step(item.id, -1)).resolves.toMatchObject({ reason: "use" });
  });

  it("undo apaga o movimento", async () => {
    const { session, item, store } = await setup();
    const used = await store.step(item.id, -1);
    await store.undo(used.id);
    const row = session.data.value.movements.find((m) => m.id === used.id);
    expect(row?.deletedAt).not.toBeNull();
    expect(quantityOf(item.id, session.data.value.movements)).toBe(2);
  });
});
