import { describe, expect, it } from "vitest";
import { compareHlc } from "../clock/hlc";
import { createRowClock } from "../clock/row-clock";
import { DEFAULT_CATEGORY_ID, SEED_HLC, seedCategories, seedLocations } from "./seeds";

describe("sementes", () => {
  it("ids iguais a cada chamada (iguais em todo aparelho)", () => {
    expect(seedCategories().map((c) => c.id)).toEqual(seedCategories().map((c) => c.id));
    expect(seedLocations().map((l) => l.id)).toEqual(seedLocations().map((l) => l.id));
  });

  it("3 categorias e 6 locais, ids distintos", () => {
    const ids = [...seedCategories(), ...seedLocations()].map((r) => r.id);
    expect(seedCategories()).toHaveLength(3);
    expect(seedLocations()).toHaveLength(6);
    expect(new Set(ids).size).toBe(9);
  });

  it("Despensa e a categoria padrao", () => {
    expect(seedCategories().find((c) => c.id === DEFAULT_CATEGORY_ID)?.name).toBe("Despensa");
  });

  it("qualquer escrita real vence a semente", () => {
    const clock = createRowClock({
      deviceId: "01J9F3K2M7QX8YB4TVWZ0DCEHZ",
      now: () => 1,
      randomChunk: (n) => Array.from({ length: n }, () => 0),
    });
    expect(compareHlc(clock.stamp().hlc, SEED_HLC)).toBe(1);
  });
});
