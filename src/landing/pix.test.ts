import { describe, expect, it } from "vitest";
import { crc16, pixField, pixPayload } from "./pix";

const base = { key: "cafe@homestock.app", name: "HomeStock", city: "SAO PAULO" };

describe("pixField", () => {
  it("id + tamanho em 2 digitos + valor", () => {
    expect(pixField("00", "01")).toBe("000201");
    expect(pixField("59", "HomeStock")).toBe("5909HomeStock");
  });
});

describe("crc16", () => {
  it("vetor padrao CCITT-FALSE", () => {
    expect(crc16("123456789")).toBe("29B1");
  });
});

describe("pixPayload", () => {
  it("R$ 5 bate com o vetor da spec", () => {
    expect(pixPayload({ ...base, amount: 5 })).toBe(
      "00020126400014br.gov.bcb.pix0118cafe@homestock.app52040000530398654045.005802BR5909HomeStock6009SAO PAULO62070503***6304F1D9",
    );
  });

  it("R$ 10 e R$ 20 mudam valor e CRC", () => {
    const dez = pixPayload({ ...base, amount: 10 });
    expect(dez).toContain("540510.00");
    expect(dez.endsWith("6304A939")).toBe(true);
    const vinte = pixPayload({ ...base, amount: 20 });
    expect(vinte).toContain("540520.00");
    expect(vinte.endsWith("630424F9")).toBe(true);
  });

  it("chave de CPF e nome com espaco", () => {
    expect(
      pixPayload({ key: "12345678900", name: "Fulano de Tal", city: "BRASILIA", amount: 10 }),
    ).toBe(
      "00020126330014br.gov.bcb.pix011112345678900520400005303986540510.005802BR5913Fulano de Tal6008BRASILIA62070503***63045BD9",
    );
  });

  it("lanca fora dos limites", () => {
    expect(() => pixPayload({ ...base, name: "A".repeat(26), amount: 5 })).toThrow();
    expect(() => pixPayload({ ...base, city: "B".repeat(16), amount: 5 })).toThrow();
    expect(() => pixPayload({ ...base, city: "São Paulo", amount: 5 })).toThrow();
    expect(() => pixPayload({ ...base, name: "Cafézinho", amount: 5 })).toThrow();
    expect(() => pixPayload({ ...base, amount: 0 })).toThrow();
    expect(() => pixPayload({ ...base, amount: -3 })).toThrow();
    expect(() => pixPayload({ ...base, key: "", amount: 5 })).toThrow();
    expect(() => pixPayload({ ...base, name: "", amount: 5 })).toThrow();
  });
});
