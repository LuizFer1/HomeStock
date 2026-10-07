import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  normalizePref,
  type PrefKey,
  type PrefRow,
  prefId,
  prefsFrom,
} from "./prefs";

function row(key: string, value: unknown, deletedAt: string | null = null): PrefRow {
  return {
    id: prefId(key as PrefKey),
    createdAt: "2026-10-06T00:00:00.000Z",
    updatedAt: "0000000000001-0000-dev",
    deletedAt,
    dirty: 1,
    authorId: null,
    key: key as PrefKey,
    value: value as PrefRow["value"],
  };
}

describe("prefsFrom", () => {
  it("sem linhas devolve os padroes", () => {
    expect(prefsFrom([])).toEqual(DEFAULT_PREFS);
  });

  it("linha viva sobrescreve o padrao", () => {
    expect(prefsFrom([row("alertLow", false)]).alertLow).toBe(false);
  });

  it("ignora linha apagada", () => {
    expect(prefsFrom([row("alertLow", false, "x")]).alertLow).toBe(true);
  });

  it("ignora chave desconhecida", () => {
    expect(prefsFrom([row("x", true)])).toEqual(DEFAULT_PREFS);
  });

  it("ignora tipo errado", () => {
    expect(prefsFrom([row("alertLow", "sim")]).alertLow).toBe(true);
  });

  it.each([0, 15, 2.5])("ignora expiringDays %s", (value) => {
    expect(prefsFrom([row("expiringDays", value)]).expiringDays).toBe(DEFAULT_PREFS.expiringDays);
  });
});

describe("prefId", () => {
  it("e estavel e distinto por chave", () => {
    expect(prefId("alertLow")).toBe(prefId("alertLow"));
    expect(prefId("alertLow")).not.toBe(prefId("autoList"));
  });
});

describe("normalizePref", () => {
  it("faz trim", () => {
    expect(normalizePref("houseName", "  Casa  ")).toBe("Casa");
  });

  it("recusa texto com 61 caracteres", () => {
    expect(() => normalizePref("houseName", "a".repeat(61))).toThrow();
    expect(normalizePref("houseName", "a".repeat(60))).toHaveLength(60);
  });

  it("recusa expiringDays 0", () => {
    expect(() => normalizePref("expiringDays", 0)).toThrow();
  });
});
