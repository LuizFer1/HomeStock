import { describe, expect, it } from "vitest";
import { localToday } from "./today";

describe("localToday", () => {
  it("usa o dia local, nao o UTC", () => {
    expect(localToday(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });

  it("poe zero a esquerda no mes e no dia", () => {
    expect(localToday(new Date(2026, 8, 3, 0, 5))).toBe("2026-09-03");
  });

  it("mes e dia de dois digitos ficam como estao", () => {
    expect(localToday(new Date(2026, 11, 31, 12))).toBe("2026-12-31");
  });
});
