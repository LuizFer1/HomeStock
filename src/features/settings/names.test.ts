import { describe, expect, it } from "vitest";
import { checkName } from "./names";

const SIBLINGS = [
  { id: "A", name: "Armário" },
  { id: "B", name: "Geladeira" },
];

describe("checkName", () => {
  it("pede um nome quando vazio ou so espacos", () => {
    expect(checkName("", SIBLINGS)).toBe("Dê um nome.");
    expect(checkName("   ", SIBLINGS)).toBe("Dê um nome.");
  });

  it("recusa mais de 40 letras", () => {
    expect(checkName("a".repeat(41), SIBLINGS)).toBe("Use até 40 letras.");
    expect(checkName("a".repeat(40), SIBLINGS)).toBeNull();
  });

  it("recusa repetido sem diferenciar caixa nem acento", () => {
    expect(checkName("armario", SIBLINGS)).toBe("Já existe Armário.");
    expect(checkName("  GELADEIRA ", SIBLINGS)).toBe("Já existe Geladeira.");
  });

  it("a propria linha pode mudar a caixa", () => {
    expect(checkName("ARMARIO", SIBLINGS, "A")).toBeNull();
    expect(checkName("geladeira", SIBLINGS, "A")).toBe("Já existe Geladeira.");
  });

  it("aceita nome novo", () => {
    expect(checkName("Garagem", SIBLINGS)).toBeNull();
  });
});
