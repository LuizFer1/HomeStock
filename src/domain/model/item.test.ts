import { describe, expect, it } from "vitest";
import { cafe } from "../../data/test-db.fake";
import { normalizeItemDraft } from "./item";

describe("normalizeItemDraft", () => {
  it("aceita o rascunho valido sem mudar nada", () => {
    expect(normalizeItemDraft(cafe())).toEqual(cafe());
  });

  it("apara o nome", () => {
    expect(normalizeItemDraft(cafe({ name: "  Café " })).name).toBe("Café");
  });

  it("recusa nome vazio e com 61 letras", () => {
    expect(() => normalizeItemDraft(cafe({ name: "   " }))).toThrow("Dê um nome ao item.");
    expect(() => normalizeItemDraft(cafe({ name: "a".repeat(61) }))).toThrow(
      "Use até 60 letras no nome.",
    );
    expect(normalizeItemDraft(cafe({ name: "a".repeat(60) })).name).toHaveLength(60);
  });

  it("recusa tamanho com 41 letras e aceita vazio", () => {
    expect(() => normalizeItemDraft(cafe({ size: "a".repeat(41) }))).toThrow(
      "Use até 40 letras no tamanho.",
    );
    expect(normalizeItemDraft(cafe({ size: " " })).size).toBe("");
  });

  it("recusa unidade vazia e com 13 letras", () => {
    expect(() => normalizeItemDraft(cafe({ unit: " " }))).toThrow("Informe a unidade.");
    expect(() => normalizeItemDraft(cafe({ unit: "a".repeat(13) }))).toThrow(
      "Use até 12 letras na unidade.",
    );
  });

  it("recusa categoria vazia", () => {
    expect(() => normalizeItemDraft(cafe({ categoryId: "" }))).toThrow("Escolha uma categoria.");
  });

  it("local vazio vira null", () => {
    expect(normalizeItemDraft(cafe({ locationId: "" })).locationId).toBeNull();
  });

  it("recusa minimo fora de 0..999 ou fracionado", () => {
    for (const min of [-1, 1000, 1.5]) {
      expect(() => normalizeItemDraft(cafe({ min }))).toThrow("O mínimo vai de 0 a 999.");
    }
    expect(normalizeItemDraft(cafe({ min: 0 })).min).toBe(0);
  });

  it("recusa compra usual 0, 1000 e fracionada", () => {
    for (const usualQty of [0, 1000, 1.5]) {
      expect(() => normalizeItemDraft(cafe({ usualQty }))).toThrow(
        "A compra usual vai de 1 a 999.",
      );
    }
  });

  it("valida a data de validade", () => {
    for (const expiresAt of ["2026-02-30", "06/10/2026"]) {
      expect(() => normalizeItemDraft(cafe({ expiresAt }))).toThrow("Data de validade inválida.");
    }
    expect(normalizeItemDraft(cafe({ expiresAt: "2026-10-06" })).expiresAt).toBe("2026-10-06");
  });

  it("limpa os espacos do EAN e recusa o que nao e 8 a 14 digitos", () => {
    expect(normalizeItemDraft(cafe({ ean: "789 1234 5678 90" })).ean).toBe("7891234567890");
    expect(normalizeItemDraft(cafe({ ean: "" })).ean).toBeNull();
    for (const ean of ["1234567", "abc12345"]) {
      expect(() => normalizeItemDraft(cafe({ ean }))).toThrow(
        "O código de barras tem de 8 a 14 dígitos.",
      );
    }
  });

  it("so aceita foto em data URL permitida", () => {
    expect(() => normalizeItemDraft(cafe({ photo: "data:image/svg+xml;base64,AAA" }))).toThrow(
      "Formato de foto não aceito.",
    );
    expect(normalizeItemDraft(cafe({ photo: "data:image/webp;base64,AAA" })).photo).toBe(
      "data:image/webp;base64,AAA",
    );
  });

  it("nao muta o rascunho", () => {
    const draft = cafe({ name: " Chá ", locationId: "", ean: " 7891234567890 " });
    const copy = { ...draft };
    const clean = normalizeItemDraft(draft);
    expect(draft).toEqual(copy);
    expect(clean).not.toBe(draft);
  });
});
