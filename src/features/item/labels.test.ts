import { describe, expect, it } from "vitest";
import { fakeItem } from "../../domain/model/row.fake";
import type { ItemStatus, PrimaryStatus } from "../../domain/projections/stock";
import { aboutDays, BLOB, expiryNote, initialOf, statusNote } from "./labels";

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
