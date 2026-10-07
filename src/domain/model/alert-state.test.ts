import { describe, expect, it } from "vitest";
import {
  type AlertState,
  alertStateId,
  MAX_ALERT_KEY,
  normalizeAlertKey,
  resolvedKeys,
} from "./alert-state";

describe("alertStateId", () => {
  it("e estavel e muda com a chave", () => {
    expect(alertStateId("low:A:start")).toBe(alertStateId("low:A:start"));
    expect(alertStateId("low:A:start")).not.toBe(alertStateId("low:B:start"));
  });
});

describe("normalizeAlertKey", () => {
  it("aceita as chaves dos alertas", () => {
    for (const key of [
      "low:01J9F3K2M7QX8YB4TVWZ0MEMBR:start",
      "exp:R0000000000000000000000001:2026-10-07",
      "act:R1",
    ]) {
      expect(normalizeAlertKey(key)).toBe(key);
    }
  });

  it("recusa chave vazia, sem partes, fora do formato ou longa", () => {
    for (const key of ["", "low", "Low:A", "low:A B", `act:${"a".repeat(MAX_ALERT_KEY)}`]) {
      expect(() => normalizeAlertKey(key)).toThrow(/Chave de alerta invalida/);
    }
  });
});

describe("resolvedKeys", () => {
  it("devolve so as chaves das linhas vivas", () => {
    const row = (key: string, deletedAt: string | null): AlertState => ({
      createdAt: "2026-10-01T12:00:00.000Z",
      updatedAt: "h",
      dirty: 0,
      authorId: null,
      id: alertStateId(key),
      key,
      deletedAt,
    });
    expect(resolvedKeys([row("act:A", null), row("act:B", "h")])).toEqual(new Set(["act:A"]));
  });
});
