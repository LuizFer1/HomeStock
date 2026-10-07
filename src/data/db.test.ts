import "fake-indexeddb/auto";
import Dexie from "dexie";
import { expect, it } from "vitest";
import { HomeStockDb } from "./db";

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
