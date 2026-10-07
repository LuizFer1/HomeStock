import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { isAlive } from "../../domain/model/base";
import { cafe } from "../../domain/model/item.fake";
import { listMarkId } from "../../domain/model/list-mark";
import { listStatusOf, shoppingList } from "../../domain/projections/shopping";
import { quantityOf } from "../../domain/projections/stock";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createShoppingStore } from "./store";

async function setup() {
  const { session } = await openTestSession({ member: ANA });
  const item = await session.run((repo) => repo.createItem(cafe(), 0));
  const store = createShoppingStore(session);
  const markOf = () =>
    session.data.value.listMarks.find((m) => m.id === listMarkId(item.id) && isAlive(m));
  const list = () => {
    const d = session.data.value;
    return shoppingList({
      items: d.items,
      movements: d.movements,
      prices: d.prices,
      marks: d.listMarks,
      extras: d.listExtras,
      autoList: true,
    });
  };
  const status = () => {
    const d = session.data.value;
    return listStatusOf(
      d.items.find((i) => i.id === item.id) ?? item,
      5,
      d.listMarks.find((m) => m.id === listMarkId(item.id)),
      true,
    );
  };
  return { session, item, store, markOf, list, status };
}

describe("toggle", () => {
  it("dois toques seguidos sem await terminam desmarcados", async () => {
    const { item, store, markOf } = await setup();
    const a = store.toggle({ kind: "item", id: item.id });
    const b = store.toggle({ kind: "item", id: item.id });
    await Promise.all([a, b]);
    expect(markOf()?.checked).toBe(0);
  });

  it("toque de pedido inverte checked", async () => {
    const { session, store } = await setup();
    const extra = await store.addExtra("Banana");
    await store.toggle({ kind: "extra", id: extra.id });
    expect(session.data.value.listExtras.find((e) => e.id === extra.id)?.checked).toBe(1);
  });
});

describe("adjust", () => {
  it("qty igual a sugestao grava null; diferente grava; preco null limpa", async () => {
    const { item, store, markOf, list } = await setup();
    const entry = () => {
      const e = list().auto[0];
      if (e === undefined) throw new Error("sem linha");
      return e;
    };
    await store.adjust(entry(), entry().suggestion, 4290);
    expect(markOf()).toMatchObject({ qty: null, priceMinor: 4290 });
    await store.adjust(entry(), 5, 4290);
    expect(markOf()).toMatchObject({ qty: 5, priceMinor: 4290 });
    await store.adjust(entry(), 5, null);
    expect(markOf()).toMatchObject({ qty: 5, priceMinor: null });
    expect(markOf()?.itemId).toBe(item.id);
  });

  it("pedido grava quantidade e preco no proprio pedido", async () => {
    const { session, store, list } = await setup();
    await store.addExtra("Banana");
    const entry = list().house[0];
    if (entry === undefined) throw new Error("sem linha");
    await store.adjust(entry, 3, 500);
    expect(session.data.value.listExtras[0]).toMatchObject({ qty: 3, priceMinor: 500 });
    await store.adjust(entry, 1, null);
    expect(session.data.value.listExtras[0]).toMatchObject({ qty: null, priceMinor: null });
  });
});

describe("addExtra", () => {
  it("grava sem espacos, recusa repetido por foldText e nome vazio", async () => {
    const { session, store } = await setup();
    await store.addExtra("  banana ");
    expect(session.data.value.listExtras.map((e) => e.name)).toEqual(["banana"]);
    await expect(store.addExtra("Banána")).rejects.toThrow("Banána já está na lista.");
    await expect(store.addExtra("")).rejects.toThrow("Dê um nome ao pedido.");
  });

  it("pedido apagado nao bloqueia o mesmo nome", async () => {
    const { store } = await setup();
    const extra = await store.addExtra("Banana");
    await store.removeExtra(extra.id);
    await expect(store.addExtra("Banana")).resolves.toMatchObject({ name: "Banana" });
    await store.restoreExtra(extra.id);
  });
});

describe("pin", () => {
  it("pin, unpin e restorePin mudam o status", async () => {
    const { item, store, status } = await setup();
    // Quantidade 5 acima do minimo: o status so depende da marca.
    expect(status()).toBe("off");
    await store.pin(item.id);
    expect(status()).toBe("pinned");
    await store.unpin(item.id);
    expect(status()).toBe("off");
    await store.restorePin(item.id);
    expect(status()).toBe("pinned");
  });
});

describe("fila serial dos comandos", () => {
  it("dois toques e o tirar da lista, sem await, terminam com a marca apagada", async () => {
    const { item, store, markOf } = await setup();
    await store.pin(item.id);
    const a = store.toggle({ kind: "item", id: item.id });
    const b = store.toggle({ kind: "item", id: item.id });
    const c = store.unpin(item.id);
    await Promise.all([a, b, c]);
    expect(markOf()).toBeUndefined();
  });

  it("fixar e tirar da lista sem await seguem a ordem dos toques", async () => {
    const { item, store, markOf } = await setup();
    const a = store.pin(item.id);
    const b = store.unpin(item.id);
    await Promise.all([a, b]);
    expect(markOf()).toBeUndefined();
  });

  it("o repor com um ajuste pendente leva a quantidade e o preco ajustados", async () => {
    const { session, item, store, list } = await setup();
    await store.toggle({ kind: "item", id: item.id });
    const seen = list();
    const entry = seen.auto[0];
    if (entry === undefined) throw new Error("sem linha");
    const adjust = store.adjust(entry, 7, 1500);
    const receipt = await store.checkout(seen);
    await adjust;
    expect(receipt.itemIds).toEqual([item.id]);
    expect(quantityOf(item.id, session.data.value.movements)).toBe(7);
    expect(session.data.value.prices.map((p) => [p.unitPriceMinor, p.qty])).toEqual([[1500, 7]]);
  });
});

describe("checkout", () => {
  it("grava so a linha marcada e o undo devolve", async () => {
    const { session, item, store, list } = await setup();
    const other = await session.run((repo) => repo.createItem(cafe({ name: "Arroz" }), 0));
    await store.toggle({ kind: "item", id: item.id });
    const receipt = await store.checkout(list());
    const moves = session.data.value.movements;
    expect(quantityOf(item.id, moves)).toBe(3);
    expect(quantityOf(other.id, moves)).toBe(0);
    await store.undoCheckout(receipt);
    expect(quantityOf(item.id, session.data.value.movements)).toBe(0);
  });

  it("o repor espera o toque pendente e nao leva a linha desmarcada", async () => {
    const { session, item, store, list } = await setup();
    await store.toggle({ kind: "item", id: item.id });
    const seen = list();
    // O toque que desmarca ainda nao gravou quando o repor sai com a lista velha.
    const pending = store.toggle({ kind: "item", id: item.id });
    const receipt = await store.checkout(seen);
    await pending;
    expect(receipt.itemIds).toEqual([]);
    expect(quantityOf(item.id, session.data.value.movements)).toBe(0);
  });

  it("pedido marcado sai da lista no repor", async () => {
    const { session, store, list } = await setup();
    const extra = await store.addExtra("Banana");
    await store.toggle({ kind: "extra", id: extra.id });
    await store.checkout(list());
    expect(session.data.value.listExtras.find((e) => e.id === extra.id)?.deletedAt).not.toBeNull();
  });
});
