import { describe, expect, it } from "vitest";
import { eanKeys, itemWithEan, scannedToEan } from "./ean";
import { fakeItem } from "./row.fake";

describe("scannedToEan", () => {
  it("aceita 13 e 8 digitos como vieram", () => {
    expect(scannedToEan("7891234567890")).toBe("7891234567890");
    expect(scannedToEan("12345670")).toBe("12345670");
  });

  it("12 digitos (UPC-A) ganham o 0 do EAN-13", () => {
    expect(scannedToEan("036000291452")).toBe("0036000291452");
  });

  it("recusa qualquer outra coisa", () => {
    expect(scannedToEan("")).toBeNull();
    expect(scannedToEan("1234567")).toBeNull();
    expect(scannedToEan("123456789")).toBeNull();
    expect(scannedToEan("12345678901")).toBeNull();
    expect(scannedToEan("12345678901234")).toBeNull();
    expect(scannedToEan("78912345678AB")).toBeNull();
    expect(scannedToEan("789 1234567890")).toBeNull();
  });

  it("nao apara espacos", () => {
    expect(scannedToEan(" 7891234567890")).toBeNull();
    expect(scannedToEan("7891234567890 ")).toBeNull();
  });
});

describe("eanKeys", () => {
  it("EAN-13 comum so tem a si mesmo", () => {
    expect(eanKeys("7891234567890")).toEqual(["7891234567890"]);
  });

  it("EAN-13 com 0 na frente acrescenta a forma de 12", () => {
    expect(eanKeys("0036000291452")).toEqual(["0036000291452", "036000291452"]);
  });

  it("12 digitos acrescenta a forma de 13", () => {
    expect(eanKeys("036000291452")).toEqual(["036000291452", "0036000291452"]);
  });

  it("8 digitos so tem a si mesmo", () => {
    expect(eanKeys("00123456")).toEqual(["00123456"]);
  });
});

describe("itemWithEan", () => {
  it("acha por EAN-13", () => {
    const item = fakeItem({ ean: "7891234567890" });
    expect(itemWithEan([fakeItem(), item], "7891234567890")).toBe(item);
  });

  it("acha o item gravado com 12 digitos lendo a forma de 13", () => {
    const item = fakeItem({ ean: "036000291452" });
    expect(itemWithEan([item], "0036000291452")).toBe(item);
  });

  it("ignora apagado e devolve null sem par", () => {
    const gone = fakeItem({ ean: "7891234567890", deletedAt: "x" });
    expect(itemWithEan([gone], "7891234567890")).toBeNull();
    expect(itemWithEan([fakeItem({ ean: "1" })], "7891234567890")).toBeNull();
  });

  it("com duplicata viva devolve o primeiro pelo nome pt-BR", () => {
    const cafe = fakeItem({ name: "Café", ean: "7891234567890" });
    const acucar = fakeItem({ name: "Açúcar", ean: "7891234567890" });
    expect(itemWithEan([cafe, acucar], "7891234567890")).toBe(acucar);
  });
});
