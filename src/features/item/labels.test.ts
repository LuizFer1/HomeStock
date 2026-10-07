import { describe, expect, it } from "vitest";
import { fakeItem } from "../../domain/model/row.fake";
import type { ItemStatus, PrimaryStatus } from "../../domain/projections/stock";
import {
  aboutDays,
  BLOB,
  barHeights,
  barLabel,
  consumptionAria,
  consumptionLegend,
  expiryChip,
  expiryNote,
  formatMoney,
  initialOf,
  minimumChip,
  runsOutChip,
  statusNote,
  stepperStatus,
} from "./labels";

function status(primary: PrimaryStatus): ItemStatus {
  return { out: primary === "out", low: primary === "low", expiring: primary === "exp", primary };
}

describe("aboutDays", () => {
  it.each([
    [0.4, "~1 dia"],
    [1, "~1 dia"],
    [5, "~5 dias"],
    [13, "~13 dias"],
    [14, "~2 semanas"],
    [20, "~3 semanas"],
    [29, "~4 semanas"],
    [30, "~1 mês"],
    [75, "~3 meses"],
  ])("%s dias -> %s", (days, text) => {
    expect(aboutDays(days)).toBe(text);
  });

  it("arredonda dias quebrados", () => {
    expect(aboutDays(8)).toBe("~8 dias");
    expect(aboutDays(10.4)).toBe("~10 dias");
  });
});

describe("expiryNote", () => {
  it.each([
    ["2026-10-05", "Venceu"],
    ["2026-10-06", "Vence hoje"],
    ["2026-10-07", "Vence amanhã"],
    ["2026-10-09", "Vence em 3 dias"],
  ])("%s -> %s", (expiresAt, text) => {
    expect(expiryNote(expiresAt, "2026-10-06")).toBe(text);
  });

  it("sem validade e null", () => {
    expect(expiryNote(null, "2026-10-06")).toBeNull();
  });
});

describe("statusNote", () => {
  const today = "2026-10-06";

  it("out, low e exp", () => {
    const item = fakeItem({ expiresAt: "2026-10-07" });
    expect(statusNote(status("out"), item, 0, null, today)).toBe("Esgotado");
    expect(statusNote(status("low"), item, 1, null, today)).toBe("Abaixo do mínimo");
    expect(statusNote(status("exp"), item, 4, null, today)).toBe("Vence amanhã");
  });

  it("ok sem media e Em dia; com media diz quanto dura o que tem", () => {
    const item = fakeItem();
    expect(statusNote(status("ok"), item, 3, null, today)).toBe("Em dia");
    expect(statusNote(status("ok"), item, 2, 10, today)).toBe("Dura ~3 semanas");
  });
});

describe("initialOf e BLOB", () => {
  it("inicial maiuscula, ? sem nome", () => {
    expect(initialOf("café")).toBe("C");
    expect(initialOf("  ")).toBe("?");
  });

  it("cores do blob do markup", () => {
    expect(BLOB.out).toEqual({ fill: "bg-accent", ink: "text-bg" });
    expect(BLOB.ok).toEqual({ fill: "bg-neutral-200", ink: "text-neutral-800" });
  });
});

describe("stepperStatus", () => {
  it.each([
    ["out", "esgotado"],
    ["low", "abaixo do mínimo"],
    ["exp", "vencendo"],
    ["ok", "em dia"],
  ] as const)("%s -> %s", (primary, text) => {
    expect(stepperStatus(primary)).toBe(text);
  });
});

describe("minimumChip", () => {
  it("min 0 e Nenhum; senao min e unidade", () => {
    expect(minimumChip(fakeItem({ min: 0, unit: "pct" }))).toBe("Nenhum");
    expect(minimumChip(fakeItem({ min: 2, unit: "pct" }))).toBe("2 pct");
  });
});

describe("expiryChip", () => {
  const today = "2026-10-06";

  it.each([
    [null, "Sem data"],
    ["2026-10-05", "Venceu"],
    ["2026-10-06", "Hoje"],
    ["2026-10-07", "Amanhã"],
    ["2026-10-09", "Em 3 dias"],
    ["2027-04-12", "abr 2027"],
    ["2027-01-01", "jan 2027"],
    ["2026-12-31", "dez 2026"],
  ])("%s -> %s com expDays 3", (expiresAt, text) => {
    expect(expiryChip(expiresAt, today, 3)).toBe(text);
  });

  it("depois de expDays vira mes e ano", () => {
    expect(expiryChip("2026-10-09", today, 2)).toBe("out 2026");
  });
});

describe("runsOutChip", () => {
  it("Acabou, Sem dados e a estimativa", () => {
    expect(runsOutChip(0, 8)).toBe("Acabou");
    expect(runsOutChip(-1, null)).toBe("Acabou");
    expect(runsOutChip(2, null)).toBe("Sem dados");
    expect(runsOutChip(2, 2.6)).toBe("~5 dias");
  });
});

describe("consumptionLegend", () => {
  it("com e sem media", () => {
    expect(consumptionLegend("pct", 8)).toBe("1 pct a cada ~8 dias");
    expect(consumptionLegend("pct", null)).toBe("Sem histórico ainda");
  });
});

describe("barLabel, barHeights e consumptionAria", () => {
  it("rotulo arredonda e mostra <1d abaixo de meio dia", () => {
    expect(barLabel(9.4)).toBe("9d");
    expect(barLabel(0.6)).toBe("1d");
    expect(barLabel(0.3)).toBe("<1d");
    expect(barLabel(0)).toBe("<1d");
  });

  it("altura relativa ao maior, no minimo 8 e escala de pelo menos 10 dias", () => {
    expect(barHeights([1, 20])).toEqual([8, 100]);
    expect(barHeights([5, 2])).toEqual([50, 20]);
    expect(barHeights([0])).toEqual([8]);
    expect(barHeights([])).toEqual([]);
  });

  it("descricao do grafico do mais antigo ao mais novo", () => {
    expect(consumptionAria([9.2, 8, 0.3])).toBe(
      "Dias por unidade, do mais antigo ao mais novo: 9, 8, menos de 1",
    );
  });
});

describe("formatMoney", () => {
  it("centavos em reais pt-BR", () => {
    // O Intl separa "R$" do valor com espaco nao separavel.
    const plain = (text: string) => text.replaceAll(String.fromCharCode(160), " ");
    expect(plain(formatMoney(4290))).toBe("R$ 42,90");
    expect(plain(formatMoney(123456))).toBe("R$ 1.234,56");
  });
});
