import { describe, expect, it } from "vitest";
import { assertExtraNumbers, normalizeExtraName, requesterOf } from "./list-extra";

describe("normalizeExtraName", () => {
  it("apara as pontas", () => {
    expect(normalizeExtraName("  Banana  ")).toBe("Banana");
  });

  it("recusa vazio e nome longo", () => {
    expect(() => normalizeExtraName("")).toThrow("Dê um nome ao pedido.");
    expect(() => normalizeExtraName("   ")).toThrow("Dê um nome ao pedido.");
    expect(normalizeExtraName("a".repeat(60))).toHaveLength(60);
    expect(() => normalizeExtraName("a".repeat(61))).toThrow("Use até 60 letras no pedido.");
  });
});

describe("requesterOf", () => {
  const base = {
    id: "E",
    createdAt: "2026-10-07T00:00:00.000Z",
    updatedAt: "0000000000001-0000-dev",
    deletedAt: null,
    dirty: 0 as const,
    authorId: "AUTOR",
    name: "Banana",
    qty: null,
    priceMinor: null,
    checked: 0 as const,
  };

  it("usa quem pediu, mesmo depois de outra pessoa escrever", () => {
    expect(requesterOf({ ...base, requestedBy: "ANA" })).toBe("ANA");
    expect(requesterOf({ ...base, requestedBy: null })).toBe("AUTOR");
  });

  it("linha antiga sem o campo cai no autor", () => {
    expect(requesterOf(base)).toBe("AUTOR");
  });
});

describe("assertExtraNumbers", () => {
  it("aceita nulos e valores validos", () => {
    expect(() => assertExtraNumbers(null, null)).not.toThrow();
    expect(() => assertExtraNumbers(1, 0)).not.toThrow();
    expect(() => assertExtraNumbers(999, 4290)).not.toThrow();
  });

  it("recusa quantidade e preco invalidos", () => {
    for (const qty of [0, 1000, 1.5]) expect(() => assertExtraNumbers(qty, null)).toThrow();
    for (const price of [-1, 1.5]) expect(() => assertExtraNumbers(null, price)).toThrow();
  });
});
