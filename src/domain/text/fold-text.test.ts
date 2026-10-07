import { describe, expect, it } from "vitest";
import { foldText } from "./fold-text";

describe("foldText", () => {
  it("tira acento, caixa e espacos das pontas", () => {
    expect(foldText("  Café em GRÃOS ")).toBe("cafe em graos");
    expect(foldText("Área de serviço")).toBe("area de servico");
  });

  it("mantem digitos e o meio intactos", () => {
    expect(foldText("Leite 1 L")).toBe("leite 1 l");
  });
});
