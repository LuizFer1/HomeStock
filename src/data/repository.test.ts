import { describe, expect, it } from "vitest";
import { compareHlc } from "../domain/clock/hlc";
import { DEFAULT_CATEGORY_ID, SEED_HLC } from "../domain/defaults/seeds";
import { listMarkId } from "../domain/model/list-mark";
import { prefId, prefsFrom } from "../domain/model/prefs";
import { quantityOf } from "../domain/projections/stock";
import { lastPriceOf } from "../domain/projections/value";
import { cafe, openTestDb, openTestRepository, TEST_MEMBER_ID } from "./test-db.fake";

describe("abertura", () => {
  it("semeia categorias e locais uma vez so", async () => {
    const db = openTestDb();
    await openTestRepository({ db });
    await openTestRepository({ db });
    expect(await db.categories.count()).toBe(3);
    expect(await db.locations.count()).toBe(6);
  });

  it("nao sobrescreve a semente editada", async () => {
    const db = openTestDb();
    const { repo } = await openTestRepository({ db });
    await repo.upsertCategory("Mercearia", DEFAULT_CATEGORY_ID);
    await openTestRepository({ db });
    expect((await db.categories.get(DEFAULT_CATEGORY_ID))?.name).toBe("Mercearia");
  });

  it("guarda o deviceId e retoma o relogio sem regredir", async () => {
    const db = openTestDb();
    const first = await openTestRepository({ db, now: () => 2_000_000_000_000 });
    const a = await first.repo.createItem(cafe());
    // Relogio de parede voltou no tempo: o HLC continua subindo.
    const second = await openTestRepository({ db, now: () => 1_000_000_000_000 });
    const b = await second.repo.createItem(cafe());
    expect(second.repo.deviceId).toBe(first.repo.deviceId);
    expect(compareHlc(b.updatedAt, a.updatedAt)).toBe(1);
  });
});

describe("comandos", () => {
  it("createItem grava a linha suja com autor e o movimento inicial", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 4);
    expect(item).toMatchObject({ dirty: 1, deletedAt: null, authorId: TEST_MEMBER_ID });
    const ms = await db.movements.toArray();
    expect(ms).toHaveLength(1);
    expect(ms[0]).toMatchObject({ itemId: item.id, delta: 4, reason: "initial", dirty: 1 });
    expect(ms[0]?.updatedAt).toBe(item.updatedAt);
  });

  it("createItem sem quantidade nao gera movimento", async () => {
    const { db, repo } = await openTestRepository();
    await repo.createItem(cafe());
    expect(await db.movements.count()).toBe(0);
  });

  it("o item nunca guarda quantidade", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 4);
    expect(Object.keys((await db.items.get(item.id)) ?? {})).not.toContain("qty");
  });

  it("updateItem muda a linha e sobe o HLC", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    const next = await repo.updateItem(item.id, { min: 5 });
    expect(next.min).toBe(5);
    expect(compareHlc(next.updatedAt, item.updatedAt)).toBe(1);
  });

  it("createItem recusa item invalido sem gravar item nem movimento", async () => {
    const { db, repo } = await openTestRepository();
    await expect(repo.createItem(cafe({ name: " " }), 4)).rejects.toThrow("Dê um nome ao item.");
    expect(await db.items.count()).toBe(0);
    expect(await db.movements.count()).toBe(0);
  });

  it("createItem grava o nome sem espacos nas pontas", async () => {
    const { repo } = await openTestRepository();
    expect((await repo.createItem(cafe({ name: "  Café " }))).name).toBe("Café");
  });

  it("updateItem recusa patch invalido e mantem a linha", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    await expect(repo.updateItem(item.id, { min: -1 })).rejects.toThrow("O mínimo vai de 0 a 999.");
    expect(await db.items.get(item.id)).toEqual(item);
  });

  it("updateItem muda so o que veio no patch", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    const next = await repo.updateItem(item.id, { name: "Chá" });
    expect(next).toMatchObject({ ...cafe(), name: "Chá" });
  });

  it("updateItem trata undefined como inalterado", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    const next = await repo.updateItem(item.id, { ean: undefined });
    expect(next.ean).toBe("7891234567890");
  });

  it("updateItem recusa quantidade", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    await expect(repo.updateItem(item.id, { qty: 9 } as never)).rejects.toThrow(/movimento/);
  });

  it("useItem, restock e adjustTo movem a soma", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 4);
    await repo.useItem(item.id);
    await repo.useItem(item.id, 2);
    await repo.restock(item.id, 3);
    expect(quantityOf(item.id, await db.movements.toArray())).toBe(4);
    const adjust = await repo.adjustTo(item.id, 10);
    expect(adjust).toMatchObject({ delta: 6, reason: "adjust" });
    expect(quantityOf(item.id, await db.movements.toArray())).toBe(10);
  });

  it("adjustTo sem diferenca nao grava", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 4);
    expect(await repo.adjustTo(item.id, 4)).toBeNull();
    expect(await db.movements.count()).toBe(1);
  });

  it("restock com preco grava o historico ligado ao movimento", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    const { movement, price } = await repo.restock(item.id, 2, 4290);
    expect(price).toMatchObject({
      itemId: item.id,
      unitPriceMinor: 4290,
      qty: 2,
      on: "2026-10-06",
    });
    expect(price?.movementId).toBe(movement.id);
    expect(lastPriceOf(item.id, await db.prices.toArray())).toBe(4290);
  });

  it("undoMovement apaga o movimento e o preco dele", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    const { movement } = await repo.restock(item.id, 2, 4290);
    await repo.undoMovement(movement.id);
    expect(quantityOf(item.id, await db.movements.toArray())).toBe(1);
    expect(lastPriceOf(item.id, await db.prices.toArray())).toBeNull();
  });

  it("deleteItem e restoreItem preservam a quantidade", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 3);
    const deleted = await repo.deleteItem(item.id);
    expect(deleted.deletedAt).toBe(deleted.updatedAt);
    await expect(repo.useItem(item.id)).rejects.toThrow(/nao existe/);
    const restored = await repo.restoreItem(item.id);
    expect(restored.deletedAt).toBeNull();
    expect(quantityOf(item.id, await db.movements.toArray())).toBe(3);
  });

  it("recusa quantidades invalidas", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    await expect(repo.useItem(item.id, 0)).rejects.toThrow();
    await expect(repo.useItem(item.id, 1.5)).rejects.toThrow();
    await expect(repo.restock(item.id, -1)).rejects.toThrow();
    await expect(repo.restock(item.id, 1, 10.5)).rejects.toThrow();
    await expect(repo.adjustTo(item.id, -1)).rejects.toThrow();
    await expect(repo.createItem(cafe(), -1)).rejects.toThrow();
  });

  it("pedidos da casa: criar, marcar e remover", async () => {
    const { repo } = await openTestRepository();
    const extra = await repo.addListExtra("Pilhas AA", 4);
    expect(extra).toMatchObject({ checked: 0, dirty: 1 });
    expect((await repo.toggleListExtra(extra.id)).checked).toBe(1);
    expect((await repo.toggleListExtra(extra.id)).checked).toBe(0);
    expect((await repo.removeListExtra(extra.id)).deletedAt).not.toBeNull();
  });

  it("categoria e local: criar, renomear e remover", async () => {
    const { repo } = await openTestRepository();
    const pet = await repo.upsertCategory("Pet");
    expect((await repo.upsertCategory("Pets", pet.id)).name).toBe("Pets");
    const quarto = await repo.upsertLocation("Quarto");
    expect((await repo.removeLocation(quarto.id)).deletedAt).not.toBeNull();
    expect((await repo.removeCategory(pet.id)).deletedAt).not.toBeNull();
  });

  it("semente editada vence o SEED_HLC", async () => {
    const { repo } = await openTestRepository();
    const edited = await repo.upsertCategory("Mercearia", DEFAULT_CATEGORY_ID);
    expect(compareHlc(edited.updatedAt, SEED_HLC)).toBe(1);
    expect(edited.dirty).toBe(1);
  });

  it("findByEan acha so item vivo", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe());
    expect((await repo.findByEan("7891234567890"))?.id).toBe(item.id);
    await repo.deleteItem(item.id);
    expect(await repo.findByEan("7891234567890")).toBeNull();
    expect(await repo.findByEan("0000")).toBeNull();
  });

  it("findByEan com exceptId acha outro item vivo com o mesmo EAN", async () => {
    const { repo } = await openTestRepository();
    // O sync pode trazer dois itens com o mesmo EAN: o indice nao e unico.
    const first = await repo.createItem(cafe());
    const second = await repo.createItem(cafe({ name: "Café 2" }));
    expect((await repo.findByEan("7891234567890", first.id))?.id).toBe(second.id);
    expect((await repo.findByEan("7891234567890", second.id))?.id).toBe(first.id);
    await repo.deleteItem(second.id);
    expect(await repo.findByEan("7891234567890", first.id)).toBeNull();
  });
});

describe("nomes de categoria e local", () => {
  it("apara o nome e rejeita vazio ou com 41 letras sem gravar", async () => {
    const { db, repo } = await openTestRepository();
    expect((await repo.upsertCategory("  Pet ")).name).toBe("Pet");
    expect((await repo.upsertLocation(" Quarto ")).name).toBe("Quarto");
    const cats = await db.categories.count();
    const locs = await db.locations.count();
    await expect(repo.upsertCategory("  ")).rejects.toThrow("Dê um nome.");
    await expect(repo.upsertLocation("a".repeat(41))).rejects.toThrow("Use até 40 letras.");
    expect(await db.categories.count()).toBe(cats);
    expect(await db.locations.count()).toBe(locs);
  });
});

describe("morador local", () => {
  it("localMemberId e null num banco novo", async () => {
    const { repo } = await openTestRepository();
    expect(await repo.localMemberId()).toBeNull();
  });

  it("createLocalMember grava admin sujo, autor ele mesmo e meta", async () => {
    const { db, repo } = await openTestRepository({ currentMemberId: () => null });
    const member = await repo.createLocalMember({ name: "  Ana ", color: "salvia", photo: null });
    expect(member).toMatchObject({ role: "admin", dirty: 1, name: "Ana", authorId: member.id });
    expect((await db.meta.get("localMemberId"))?.value).toBe(member.id);
    expect(await repo.localMemberId()).toBe(member.id);
    await expect(
      repo.createLocalMember({ name: "Bia", color: "cafe", photo: null }),
    ).rejects.toThrow();
    expect(await db.members.count()).toBe(1);
  });

  it("createLocalMember com nome vazio rejeita e nao grava meta", async () => {
    const { db, repo } = await openTestRepository();
    await expect(
      repo.createLocalMember({ name: " ", color: "salvia", photo: null }),
    ).rejects.toThrow("Informe seu nome.");
    expect(await db.meta.get("localMemberId")).toBeUndefined();
    expect(await db.members.count()).toBe(0);
  });

  it("updateMember trata undefined como inalterado", async () => {
    const { repo } = await openTestRepository();
    const photo = "data:image/webp;base64,AAAA";
    const member = await repo.createLocalMember({ name: "Ana", color: "salvia", photo });
    const next = await repo.updateMember(member.id, { photo: undefined, name: "Rafa" });
    expect(next).toMatchObject({ name: "Rafa", photo });
  });

  it("updateMember muda a cor, mantem o nome e carimba", async () => {
    const { repo } = await openTestRepository();
    const member = await repo.createLocalMember({ name: "Ana", color: "salvia", photo: null });
    const next = await repo.updateMember(member.id, { color: "cacau" });
    expect(next).toMatchObject({ name: "Ana", color: "cacau", authorId: TEST_MEMBER_ID });
    expect(compareHlc(next.updatedAt, member.updatedAt)).toBe(1);
  });
});

describe("preferencias", () => {
  it("setPref revive linha apagada", async () => {
    const { db, repo } = await openTestRepository();
    const row = await repo.setPref("alertLow", true);
    await db.prefs.put({ ...row, deletedAt: row.updatedAt });
    await repo.setPref("alertLow", false);
    expect((await db.prefs.get(row.id))?.deletedAt).toBeNull();
    expect(prefsFrom((await repo.snapshot()).prefs).alertLow).toBe(false);
  });

  it("setPref cria a linha e a segunda chamada carimba a mesma", async () => {
    const { db, repo } = await openTestRepository();
    const first = await repo.setPref("alertLow", false);
    expect(first.id).toBe(prefId("alertLow"));
    const second = await repo.setPref("alertLow", true);
    expect(await db.prefs.count()).toBe(1);
    expect(compareHlc(second.updatedAt, first.updatedAt)).toBe(1);
    expect((await repo.snapshot()).prefs).toHaveLength(1);
  });

  it("setPref rejeita valor invalido", async () => {
    const { db, repo } = await openTestRepository();
    await expect(repo.setPref("expiringDays", 0)).rejects.toThrow();
    expect(await db.prefs.count()).toBe(0);
  });
});

describe("preco no cadastro e validade na reposicao", () => {
  it("createItem com preco grava restock e Price, sem initial", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 3, 4290);
    const movements = await db.movements.toArray();
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ itemId: item.id, delta: 3, reason: "restock" });
    const prices = await db.prices.toArray();
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({
      itemId: item.id,
      unitPriceMinor: 4290,
      qty: 3,
      on: "2026-10-06",
      movementId: movements[0]?.id,
    });
  });

  it("createItem recusa preco sem quantidade ou invalido e nao grava item", async () => {
    const { db, repo } = await openTestRepository();
    await expect(repo.createItem(cafe(), 0, 4290)).rejects.toThrow(/quantidade inicial >= 1/);
    await expect(repo.createItem(cafe(), 2, -1)).rejects.toThrow();
    await expect(repo.createItem(cafe(), 2, 1.5)).rejects.toThrow();
    expect(await db.items.count()).toBe(0);
  });

  it("createItem sem preco continua com initial e nenhum preco", async () => {
    const { db, repo } = await openTestRepository();
    await repo.createItem(cafe(), 2);
    expect((await db.movements.toArray()).map((m) => m.reason)).toEqual(["initial"]);
    expect(await db.prices.count()).toBe(0);
  });

  it("restock sem validade nova devolve expiry igual e nao regrava o item", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }), 2);
    const { expiry } = await repo.restock(item.id, 1);
    expect(expiry).toEqual({ before: "2026-12-01", after: "2026-12-01" });
    expect((await db.items.get(item.id))?.updatedAt).toBe(item.updatedAt);
  });

  it("restock mantem a validade mais proxima quando ha estoque", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }), 2);
    const { expiry } = await repo.restock(item.id, 1, undefined, "2027-03-01");
    expect(expiry).toEqual({ before: "2026-12-01", after: "2026-12-01" });
    expect((await db.items.get(item.id))?.expiresAt).toBe("2026-12-01");
    expect((await db.items.get(item.id))?.updatedAt).toBe(item.updatedAt);
  });

  it("restock troca a validade com 0 unidades e com validade nula", async () => {
    const { db, repo } = await openTestRepository();
    const empty = await repo.createItem(cafe({ expiresAt: "2026-12-01" }));
    const r1 = await repo.restock(empty.id, 1, undefined, "2027-03-01");
    expect(r1.expiry).toEqual({ before: "2026-12-01", after: "2027-03-01" });
    expect((await db.items.get(empty.id))?.expiresAt).toBe("2027-03-01");
    expect((await db.items.get(empty.id))?.updatedAt).toBe(r1.movement.updatedAt);

    const noDate = await repo.createItem(cafe({ expiresAt: null, ean: null }), 2);
    const r2 = await repo.restock(noDate.id, 1, undefined, "2027-03-01");
    expect(r2.expiry).toEqual({ before: null, after: "2027-03-01" });
    expect((await db.items.get(noDate.id))?.expiresAt).toBe("2027-03-01");
  });

  it("reposicao em sequencia: desfazer a primeira devolve a validade original", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }));
    const a = await repo.restock(item.id, 1, undefined, "2027-03-01");
    await repo.restock(item.id, 1, undefined, "2027-03-01");
    await repo.undoMovement(a.movement.id, a.expiry);
    // Comportamento atual: a validade ainda e a que A gravou, entao volta ao valor anterior a A.
    expect((await db.items.get(item.id))?.expiresAt).toBe("2026-12-01");
  });

  it("undoMovement com expiry devolve a validade que a reposicao trocou", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }));
    const { movement, expiry } = await repo.restock(item.id, 1, 4290, "2027-03-01");
    await repo.undoMovement(movement.id, expiry);
    expect((await db.items.get(item.id))?.expiresAt).toBe("2026-12-01");
  });

  it("undoMovement nao desfaz validade mudada depois por outra tela", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }));
    const { movement, expiry } = await repo.restock(item.id, 1, undefined, "2027-03-01");
    await repo.updateItem(item.id, { expiresAt: "2027-05-01" });
    await repo.undoMovement(movement.id, expiry);
    expect((await db.items.get(item.id))?.expiresAt).toBe("2027-05-01");
  });

  it("undoMovement sem expiry nao mexe no item", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe({ expiresAt: "2026-12-01" }));
    const { movement } = await repo.restock(item.id, 1, undefined, "2027-03-01");
    await repo.undoMovement(movement.id);
    expect((await db.items.get(item.id))?.expiresAt).toBe("2027-03-01");
  });
});

describe("marca da lista", () => {
  it("markItem cria a linha de id estavel e atualiza a mesma", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    const first = await repo.markItem(item.id, { checked: 1 });
    expect(first).toMatchObject({
      id: listMarkId(item.id),
      itemId: item.id,
      checked: 1,
      qty: null,
      priceMinor: null,
      pinned: 0,
      pinnedBy: null,
      dirty: 1,
      deletedAt: null,
    });
    const second = await repo.markItem(item.id, { qty: 2 });
    expect(second).toMatchObject({ id: first.id, checked: 1, qty: 2 });
    expect(await db.listMarks.count()).toBe(1);
  });

  it("markItem de item apagado rejeita sem gravar", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.deleteItem(item.id);
    await expect(repo.markItem(item.id, { checked: 1 })).rejects.toThrow(/nao existe/);
    await expect(repo.markItem(item.id, { qty: 0 })).rejects.toThrow();
    expect(await db.listMarks.count()).toBe(0);
  });

  it("fixar grava quem fixou; desafixar limpa", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 5);
    expect((await repo.markItem(item.id, { pinned: 1 })).pinnedBy).toBe(TEST_MEMBER_ID);
    expect((await repo.markItem(item.id, { checked: 1 })).pinnedBy).toBe(TEST_MEMBER_ID);
    expect((await repo.markItem(item.id, { pinned: 0 })).pinnedBy).toBeNull();
  });

  it("toggleItemMark inverte o valor do banco na mesma linha", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    expect((await repo.toggleItemMark(item.id)).checked).toBe(1);
    expect((await repo.toggleItemMark(item.id)).checked).toBe(0);
    expect(await db.listMarks.count()).toBe(1);
  });

  it("linha apagada revive com os padroes", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1, qty: 5, priceMinor: 990 });
    await repo.unpinItem(item.id);
    const revived = await repo.markItem(item.id, { pinned: 1 });
    expect(revived).toMatchObject({
      checked: 0,
      qty: null,
      priceMinor: null,
      pinned: 1,
      deletedAt: null,
    });
  });

  it("restoreItemMark devolve os campos que a marca tinha", async () => {
    const { repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1, qty: 5, priceMinor: 990 });
    expect((await repo.unpinItem(item.id)).deletedAt).not.toBeNull();
    const restored = await repo.restoreItemMark(item.id);
    expect(restored).toMatchObject({ checked: 1, qty: 5, priceMinor: 990, deletedAt: null });
  });

  it("restock apaga a marca no mesmo carimbo", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1, pinned: 1 });
    const { movement } = await repo.restock(item.id, 1);
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBe(movement.updatedAt);
  });

  it("restock sem marca nao grava em listMarks", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.restock(item.id, 1);
    expect(await db.listMarks.count()).toBe(0);
  });

  it("adjustTo apaga a marca nao fixada quando o item sai da lista", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1 });
    await repo.adjustTo(item.id, 1);
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBeNull();
    const movement = await repo.adjustTo(item.id, 2);
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBe(movement?.updatedAt);
  });

  it("adjustTo mantem a marca fixada", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1, pinned: 1 });
    await repo.adjustTo(item.id, 5);
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBeNull();
  });

  it("updateItem apaga a marca nao fixada so quando o item sai da lista", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 1);
    await repo.markItem(item.id, { checked: 1 });
    await repo.updateItem(item.id, { name: "Café" });
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBeNull();
    const next = await repo.updateItem(item.id, { min: 0 });
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).toBe(next.updatedAt);
  });

  it("undoMovement que devolve o item ao minimo apaga a marca nao fixada", async () => {
    const { db, repo } = await openTestRepository();
    const item = await repo.createItem(cafe(), 2);
    const use = await repo.useItem(item.id);
    await repo.markItem(item.id, { checked: 1 });
    await repo.undoMovement(use.id);
    expect((await db.listMarks.get(listMarkId(item.id)))?.deletedAt).not.toBeNull();
    expect(quantityOf(item.id, await db.movements.toArray())).toBe(2);
  });
});

describe("pedidos da casa validados", () => {
  it("addListExtra apara o nome e grava quem pediu", async () => {
    const { repo } = await openTestRepository();
    const extra = await repo.addListExtra("  Banana ");
    expect(extra).toMatchObject({
      name: "Banana",
      requestedBy: TEST_MEMBER_ID,
      checked: 0,
      qty: null,
      priceMinor: null,
    });
  });

  it("addListExtra recusa nome vazio e quantidade invalida sem gravar", async () => {
    const { db, repo } = await openTestRepository();
    await expect(repo.addListExtra("")).rejects.toThrow("Dê um nome ao pedido.");
    await expect(repo.addListExtra("Pão", 0)).rejects.toThrow();
    await expect(repo.addListExtra("Pão", 1, -1)).rejects.toThrow();
    expect(await db.listExtras.count()).toBe(0);
  });

  it("updateListExtra grava e recusa pedido apagado", async () => {
    const { repo } = await openTestRepository();
    const extra = await repo.addListExtra("Banana");
    const next = await repo.updateListExtra(extra.id, { qty: 2, priceMinor: 799 });
    expect(next).toMatchObject({ qty: 2, priceMinor: 799, name: "Banana" });
    expect(compareHlc(next.updatedAt, extra.updatedAt)).toBe(1);
    await expect(repo.updateListExtra(extra.id, { qty: 0 })).rejects.toThrow();
    await repo.removeListExtra(extra.id);
    await expect(repo.updateListExtra(extra.id, { qty: 3 })).rejects.toThrow(/nao existe/);
  });

  it("updateListExtra trata undefined como inalterado", async () => {
    const { repo } = await openTestRepository();
    const extra = await repo.addListExtra("Banana", 2, 799);
    expect(await repo.updateListExtra(extra.id, { priceMinor: null })).toMatchObject({
      qty: 2,
      priceMinor: null,
    });
  });

  it("removeListExtra e restoreListExtra devolvem o pedido", async () => {
    const { repo } = await openTestRepository();
    const extra = await repo.addListExtra("Banana");
    await repo.removeListExtra(extra.id);
    expect((await repo.restoreListExtra(extra.id)).deletedAt).toBeNull();
  });
});

describe("repor em lote", () => {
  async function market() {
    const ctx = await openTestRepository();
    const { repo } = ctx;
    const coffee = await repo.createItem(cafe(), 1);
    const det = await repo.createItem(cafe({ name: "Detergente", ean: null }));
    await repo.markItem(coffee.id, { checked: 1, qty: 2 });
    await repo.markItem(det.id, { checked: 1 });
    const banana = await repo.addListExtra("Banana");
    await repo.toggleListExtra(banana.id);
    return { ...ctx, coffee, det, banana };
  }

  it("checkout repoe, grava o preco digitado e limpa marcas e pedidos", async () => {
    const { db, repo, coffee, det, banana } = await market();
    const receipt = await repo.checkout({
      items: [
        { itemId: coffee.id, qty: 2, unitPriceMinor: 4290 },
        { itemId: det.id, qty: 3, unitPriceMinor: null },
      ],
      extraIds: [banana.id],
    });
    const restocks = (await db.movements.toArray()).filter((m) => m.reason === "restock");
    expect(restocks.map((m) => [m.itemId, m.delta])).toEqual([
      [coffee.id, 2],
      [det.id, 3],
    ]);
    expect(restocks[0]?.updatedAt).toBe(restocks[1]?.updatedAt);
    const prices = await db.prices.toArray();
    expect(prices).toHaveLength(1);
    expect(prices[0]).toMatchObject({
      itemId: coffee.id,
      unitPriceMinor: 4290,
      qty: 2,
      on: "2026-10-06",
      movementId: restocks[0]?.id,
    });
    const stamp = restocks[0]?.updatedAt;
    expect((await db.listMarks.get(listMarkId(coffee.id)))?.deletedAt).toBe(stamp);
    expect((await db.listMarks.get(listMarkId(det.id)))?.deletedAt).toBe(stamp);
    expect((await db.listExtras.get(banana.id))?.deletedAt).toBe(stamp);
    expect(receipt.movementIds).toHaveLength(2);
    expect(receipt.markIds).toEqual([listMarkId(coffee.id), listMarkId(det.id)]);
    expect(receipt.extraIds).toEqual([banana.id]);
  });

  it("checkout pula item apagado no meio e grava o resto", async () => {
    const { db, repo, coffee, det } = await market();
    await repo.deleteItem(det.id);
    const receipt = await repo.checkout({
      items: [
        { itemId: coffee.id, qty: 2, unitPriceMinor: null },
        { itemId: det.id, qty: 3, unitPriceMinor: null },
      ],
      extraIds: [],
    });
    expect(receipt.movementIds).toHaveLength(1);
    const forDet = (await db.movements.toArray()).filter((m) => m.itemId === det.id);
    expect(forDet).toHaveLength(0);
    expect(quantityOf(coffee.id, await db.movements.toArray())).toBe(3);
  });

  it("checkout com quantidade invalida rejeita sem gravar nada", async () => {
    const { db, repo, coffee, det, banana } = await market();
    const before = await db.movements.count();
    await expect(
      repo.checkout({
        items: [
          { itemId: coffee.id, qty: 2, unitPriceMinor: null },
          { itemId: det.id, qty: 0, unitPriceMinor: null },
        ],
        extraIds: [banana.id],
      }),
    ).rejects.toThrow();
    await expect(
      repo.checkout({ items: [{ itemId: coffee.id, qty: 1, unitPriceMinor: -1 }], extraIds: [] }),
    ).rejects.toThrow();
    expect(await db.movements.count()).toBe(before);
    expect((await db.listMarks.get(listMarkId(coffee.id)))?.deletedAt).toBeNull();
    expect((await db.listExtras.get(banana.id))?.deletedAt).toBeNull();
  });

  it("undoCheckout devolve marcas, pedidos e a soma", async () => {
    const { db, repo, coffee, det, banana } = await market();
    const receipt = await repo.checkout({
      items: [
        { itemId: coffee.id, qty: 2, unitPriceMinor: 4290 },
        { itemId: det.id, qty: 3, unitPriceMinor: null },
      ],
      extraIds: [banana.id],
    });
    await repo.undoCheckout(receipt);
    for (const id of receipt.movementIds) {
      expect((await db.movements.get(id))?.deletedAt).not.toBeNull();
    }
    expect((await db.prices.toArray())[0]?.deletedAt).not.toBeNull();
    expect(await db.listMarks.get(listMarkId(coffee.id))).toMatchObject({
      deletedAt: null,
      checked: 1,
      qty: 2,
    });
    expect(await db.listMarks.get(listMarkId(det.id))).toMatchObject({
      deletedAt: null,
      checked: 1,
    });
    expect(await db.listExtras.get(banana.id)).toMatchObject({ deletedAt: null, checked: 1 });
    expect(quantityOf(coffee.id, await db.movements.toArray())).toBe(1);
    expect(quantityOf(det.id, await db.movements.toArray())).toBe(0);
  });
});
