import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import type { BaseRow } from "../domain/model/base";
import { mergeRow } from "../domain/model/merge";
import { prefsFrom } from "../domain/model/prefs";
import { quantityOf } from "../domain/projections/stock";
import { type HomeStockDb, SYNCED_TABLES } from "./db";
import type { Repository } from "./repository";
import { cafe, openTestRepository, testClock } from "./test-db.fake";

/**
 * Sync minimo, so para o teste: manda todas as linhas de um aparelho para o
 * outro, aplicando o LWW por linha. O cliente do HubStock (fatia 7) faz o mesmo
 * com `dirty`, rede e confirmacao.
 */
async function send(from: HomeStockDb, to: HomeStockDb, toRepo: Repository): Promise<void> {
  for (const name of SYNCED_TABLES) {
    const source = from.table<BaseRow, string>(name);
    const target = to.table<BaseRow, string>(name);
    for (const remote of await source.toArray()) {
      toRepo.observe(remote.updatedAt);
      const local = await target.get(remote.id);
      const winner = mergeRow(local, remote);
      if (winner !== local) await target.put({ ...winner, dirty: 0 });
    }
  }
}

async function device(seed: number, now: () => number) {
  return openTestRepository({ seed, now });
}

describe("convergencia entre dois aparelhos", () => {
  it("consumos somam; o item fica com a linha mais nova inteira", async () => {
    // Um relogio so: a ordem das chamadas e a ordem dos HLCs.
    const now = testClock();
    const a = await device(1, now);
    const b = await device(2, now);

    const item = await a.repo.createItem(cafe(), 5);
    await send(a.db, b.db, b.repo);

    // Offline, cada um no seu celular.
    await a.repo.useItem(item.id, 1);
    await b.repo.useItem(item.id, 2);
    await b.repo.updateItem(item.id, { name: "Café moído" });
    await a.repo.updateItem(item.id, { min: 4 });

    // Ordens diferentes de troca.
    await send(a.db, b.db, b.repo);
    await send(b.db, a.db, a.repo);
    await send(a.db, b.db, b.repo);

    for (const { repo } of [a, b]) {
      const snap = await repo.snapshot();
      expect(quantityOf(item.id, snap.movements)).toBe(2);
      const merged = snap.items.find((i) => i.id === item.id);
      // LWW por linha: a edicao de A e posterior, entao a linha de A vence
      // inteira e a renomeacao de B se perde. E por isso que a quantidade nao
      // mora no item.
      expect(merged).toMatchObject({ name: "Café em grãos", min: 4 });
    }

    const [snapA, snapB] = [await a.repo.snapshot(), await b.repo.snapshot()];
    const strip = (rows: BaseRow[]) =>
      rows.map(({ dirty: _d, ...rest }) => rest).sort((x, y) => x.id.localeCompare(y.id));
    expect(strip(snapA.items)).toEqual(strip(snapB.items));
    expect(strip(snapA.movements)).toEqual(strip(snapB.movements));
  });

  it("sementes nao duplicam entre aparelhos", async () => {
    const now = testClock();
    const a = await device(1, now);
    const b = await device(2, now);
    await send(a.db, b.db, b.repo);
    expect(await b.db.categories.count()).toBe(3);
    expect(await b.db.locations.count()).toBe(6);
  });

  it("apagar num aparelho chega no outro", async () => {
    const now = testClock();
    const a = await device(1, now);
    const b = await device(2, now);
    const item = await a.repo.createItem(cafe(), 1);
    await send(a.db, b.db, b.repo);
    await b.repo.deleteItem(item.id);
    await send(b.db, a.db, a.repo);
    expect((await a.db.items.get(item.id))?.deletedAt).not.toBeNull();
  });

  it("duas escritas da mesma preferencia viram uma linha com a de HLC maior", async () => {
    const now = testClock();
    const a = await device(1, now);
    const b = await device(2, now);
    await a.repo.setPref("autoList", false);
    await b.repo.setPref("autoList", true);
    await send(a.db, b.db, b.repo);
    await send(b.db, a.db, a.repo);
    for (const { db } of [a, b]) {
      const rows = await db.prefs.toArray();
      expect(rows).toHaveLength(1);
      expect(rows[0]?.value).toBe(true);
    }
  });

  it("preferencias de chaves diferentes convivem", async () => {
    const now = testClock();
    const a = await device(1, now);
    const b = await device(2, now);
    await a.repo.setPref("houseName", "Casa Azul");
    await b.repo.setPref("alertLow", false);
    await send(a.db, b.db, b.repo);
    await send(b.db, a.db, a.repo);
    for (const { repo } of [a, b]) {
      const prefs = prefsFrom((await repo.snapshot()).prefs);
      expect(prefs).toMatchObject({ houseName: "Casa Azul", alertLow: false });
    }
  });
});
