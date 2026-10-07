import { describe, expect, it } from "vitest";
import { localDayOf, localToday } from "./today";

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

describe("localDayOf", () => {
  it("devolve o dia local do ISO", () => {
    expect(localDayOf(new Date(2026, 9, 6, 23, 30).toISOString())).toBe("2026-10-06");
  });
});
