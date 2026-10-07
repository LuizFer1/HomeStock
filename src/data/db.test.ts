import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { HomeStockDb, SYNCED_TABLES } from "./db";

it("abrir na versao 2 mantem os dados da versao 1 e cria prefs vazia", async () => {
  const name = `homestock-migracao-${Date.now()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    items: "id, ean, dirty",
    categories: "id, dirty",
    locations: "id, dirty",
    members: "id, dirty",
    listExtras: "id, dirty",
    movements: "id, itemId, dirty",
    prices: "id, itemId, dirty",
    meta: "key",
  });
  await old.table("categories").put({ id: "C1", name: "Antiga", dirty: 0 });
  old.close();

  const db = new HomeStockDb(name);
  expect((await db.categories.get("C1"))?.name).toBe("Antiga");
  expect(await db.prefs.count()).toBe(0);
  db.close();
});

it("abrir na versao 3 mantem os dados da versao 2 e cria listMarks vazia", async () => {
  const name = `homestock-migracao-v3-${Date.now()}`;
  const old = new Dexie(name);
  old.version(1).stores({
    items: "id, ean, dirty",
    categories: "id, dirty",
    locations: "id, dirty",
    members: "id, dirty",
    listExtras: "id, dirty",
    movements: "id, itemId, dirty",
    prices: "id, itemId, dirty",
    meta: "key",
  });
  old.version(2).stores({ prefs: "id, dirty" });
  await old.table("prefs").put({ id: "P1", key: "alertLow", value: false, dirty: 0 });
  await old.table("listExtras").put({ id: "E1", name: "Banana", checked: 0, dirty: 0 });
  old.close();

  const db = new HomeStockDb(name);
  expect((await db.prefs.get("P1"))?.value).toBe(false);
  expect((await db.listExtras.get("E1"))?.name).toBe("Banana");
  expect(await db.listMarks.count()).toBe(0);
  db.close();
});

it("listMarks sincroniza depois dos pedidos", () => {
  expect(SYNCED_TABLES.at(-1)).toBe("listMarks");
  expect(SYNCED_TABLES.indexOf("listExtras")).toBe(SYNCED_TABLES.length - 2);
});
