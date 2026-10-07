import { describe, expect, it } from "vitest";
import { greeting, healthPercent, healthSubtitle, itemsLine } from "./labels";

describe("rotulos do Inicio", () => {
  it("saudacao pela primeira palavra", () => {
    expect(greeting("Ana Maria")).toBe("Oi, Ana!");
    expect(greeting("  Rafa ")).toBe("Oi, Rafa!");
    expect(greeting(null)).toBe("Oi!");
    expect(greeting("   ")).toBe("Oi!");
  });

  it("subtitulo pela saude", () => {
    expect(healthSubtitle(null)).toBe("Seu estoque ainda está vazio.");
    expect(healthSubtitle(1)).toBe("Sua casa está toda abastecida.");
    expect(healthSubtitle(0.82)).toBe("Sua casa está quase toda abastecida.");
    expect(healthSubtitle(0.7)).toBe("Sua casa está quase toda abastecida.");
    expect(healthSubtitle(0.5)).toBe("Alguns itens pedem atenção.");
  });

  it("percentual", () => {
    expect(healthPercent(0.824)).toBe("82%");
    expect(healthPercent(null)).toBe("—");
  });

  it("linha de itens", () => {
    expect(itemsLine(86, 71)).toBe("86 itens · 71 em dia");
    expect(itemsLine(1, 0)).toBe("1 item · 0 em dia");
    expect(itemsLine(0, 0)).toBe("0 itens · 0 em dia");
  });
});
