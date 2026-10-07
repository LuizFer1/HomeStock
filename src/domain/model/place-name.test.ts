import { describe, expect, it } from "vitest";
import { normalizePlaceName } from "./place-name";

describe("normalizePlaceName", () => {
  it("apara os espacos", () => {
    expect(normalizePlaceName("  Pet ")).toBe("Pet");
  });

  it("rejeita vazio", () => {
    expect(() => normalizePlaceName("   ")).toThrow("Dê um nome.");
  });

  it("aceita 40 e rejeita 41 letras", () => {
    expect(normalizePlaceName("a".repeat(40))).toHaveLength(40);
    expect(() => normalizePlaceName("a".repeat(41))).toThrow("Use até 40 letras.");
  });
});
