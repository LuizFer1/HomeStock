import { describe, expect, it } from "vitest";
import { formatBRL, msgKey, nextStep, STEPS, simFrame, TAB_START } from "./sim";

/** O Intl usa espaco nao separavel entre "R$" e o numero. */
const money = (s: string) => s.replace(/\s/g, " ");

describe("ciclo", () => {
  it("o passo volta ao zero depois do ultimo", () => {
    expect(STEPS).toBe(11);
    expect(nextStep(10)).toBe(0);
    expect(nextStep(3)).toBe(4);
  });

  it("cada aba comeca num passo", () => {
    expect(TAB_START).toEqual({ home: 0, scan: 3, list: 7 });
  });

  it("msgKey por fase", () => {
    const keys = Array.from({ length: STEPS }, (_, s) => msgKey(s));
    expect(keys).toEqual([
      "leite",
      "sabao",
      "sabao",
      "scan",
      "scan",
      "scan",
      "cafe",
      "list",
      "list",
      "list",
      "list",
    ]);
  });

  it("formatBRL usa o formato brasileiro", () => {
    expect(money(formatBRL(1284.5))).toBe("R$ 1.284,50");
  });
});

describe("simFrame", () => {
  it("passo 0: casa abastecida, aviso do leite", () => {
    const f = simFrame(0);
    expect(f.screen).toBe("home");
    expect(f.pct).toBe(82);
    expect(f.ringDash).toBe("196 239");
    expect(money(f.value)).toBe("R$ 1.284,50");
    expect(f.acabando).toBe(4);
    expect(f.naLista).toBe(5);
    expect(f.rows[0]).toMatchObject({
      letter: "C",
      name: "Café em grãos",
      note: "Abaixo do mínimo",
      qty: "1 pct",
      tone: "warn",
    });
    expect(f.rows[1]).toMatchObject({
      letter: "S",
      note: "Último pacote",
      qty: "1 un",
    });
    expect(f.rows[2]).toMatchObject({ letter: "I", name: "Iogurte natural", qty: "2 un" });
    expect(f.rows.map((r) => r.highlight)).toEqual(["none", "none", "none"]);
    expect(f.fabPulse).toBe(false);
    expect(f.msgTitle).toBe("Leite vence em 3 dias");
  });

  it("passo 1: o sabao acabou e foi para a lista", () => {
    const f = simFrame(1);
    expect(f.pct).toBe(80);
    expect(f.ringDash).toBe("191 239");
    expect(money(f.value)).toBe("R$ 1.249,60");
    expect(f.acabando).toBe(5);
    expect(f.naLista).toBe(6);
    expect(f.rows[1]).toMatchObject({
      note: "Esgotado · na lista",
      qty: "0 un",
      tone: "out",
      highlight: "warn",
    });
    expect(f.msgTitle).toBe("Rafa usou o último sabão");
  });

  it("passo 2: o botao pulsa e o sabao segue destacado", () => {
    const f = simFrame(2);
    expect(f.fabPulse).toBe(true);
    expect(f.rows[1]?.highlight).toBe("warn");
  });

  it("passos 3 a 5: tela de escanear", () => {
    expect([3, 4, 5].map((s) => simFrame(s).screen)).toEqual(["scan", "scan", "scan"]);
    expect([3, 4, 5].map((s) => simFrame(s).scanFound)).toEqual([false, true, true]);
    expect([3, 4, 5].map((s) => simFrame(s).savePressed)).toEqual([false, false, true]);
  });

  it("passo 6: o cafe foi reposto", () => {
    const f = simFrame(6);
    expect(f.screen).toBe("home");
    expect(f.pct).toBe(86);
    expect(f.ringDash).toBe("206 239");
    expect(money(f.value)).toBe("R$ 1.335,40");
    expect(f.rows[0]).toMatchObject({
      note: "Reposto agora",
      qty: "3 pct",
      tone: "ok",
      highlight: "ok",
    });
    expect(f.acabando).toBe(4);
    expect(f.msgTitle).toBe("Ana guardou 2 cafés");
  });

  it("passo 7: lista sem nada marcado", () => {
    const f = simFrame(7);
    expect(f.screen).toBe("list");
    expect(f.checked).toBe(0);
    expect(f.listDone).toBe("0 de 5");
    expect(f.listWidth).toBe("0%");
    expect(money(f.listLeft)).toBe("R$ 93,76");
    expect(f.msgTitle).toBe("Lista: 0 de 5 comprados");
    expect(f.msgSub).toBe("Rafa está no mercado");
  });

  it("passo 10: tres itens marcados", () => {
    const f = simFrame(10);
    expect(f.checked).toBe(3);
    expect(f.listWidth).toBe("60%");
    expect(money(f.listLeft)).toBe("R$ 14,49");
    expect(f.msgTitle).toBe("Lista: 3 de 5 comprados");
  });
});
