import { describe, expect, it } from "vitest";
import { MAX_PRICE_MINOR, maskPrice } from "./money";

function masked(input: string) {
  const { text, minor } = maskPrice(input);
  return { text: text.replace(/ /g, " "), minor };
}

describe("maskPrice", () => {
  it("os digitos entram da direita para a esquerda", () => {
    expect(masked("4290")).toEqual({ text: "R$ 42,90", minor: 4290 });
    expect(masked("R$ 42,9")).toEqual({ text: "R$ 4,29", minor: 429 });
    expect(masked("5")).toEqual({ text: "R$ 0,05", minor: 5 });
    expect(masked("R$ 1.234,56")).toEqual({ text: "R$ 1.234,56", minor: 123456 });
  });

  it("sem digitos ou so zeros o campo fica vazio", () => {
    for (const input of ["abc", "", "0", "000"]) {
      expect(masked(input)).toEqual({ text: "", minor: null });
    }
  });

  it("corta em sete digitos", () => {
    expect(maskPrice("123456789").minor).toBe(1234567);
    expect(MAX_PRICE_MINOR).toBe(9_999_999);
    expect(maskPrice("9".repeat(12)).minor).toBe(MAX_PRICE_MINOR);
  });
});
