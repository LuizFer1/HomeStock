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
