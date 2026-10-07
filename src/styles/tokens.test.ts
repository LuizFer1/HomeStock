import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(import.meta.dirname, "tokens.css"), "utf8");

function token(name: string): string | undefined {
  return new RegExp(`--${name}:s*([^;]+);`).exec(css)?.[1]?.trim();
}

// Valores copiados do README do handoff (Design Tokens, Organic).
const BASE = {
  bg: "#f5ead8",
  surface: "#ebddc5",
  text: "#201e1d",
  accent: "#c67139",
  "accent-2": "#7a8a5e",
};

const RAMPS = {
  neutral: "#f9f4ed #eee7db #dcd3c4 #c0b6a5 #a19786 #82796a #645c50 #474238 #2e2b25",
  accent: "#fff2eb #ffe1d0 #ffc6a5 #f6a06b #d67f48 #b2622d #8c491a #643312 #402310",
  "accent-2": "#f0fae1 #e1eecc #ccdbb2 #aebf92 #8fa073 #728157 #56633f #3d472b #272e1b",
};

describe("tokens Organic", () => {
  it.each(Object.entries(BASE))("cor base %s", (name, hex) => {
    expect(token(`color-${name}`)).toBe(hex);
  });

  it.each(Object.entries(RAMPS))("rampa %s de 100 a 900", (name, values) => {
    const hexes = values.split(" ");
    hexes.forEach((hex, i) => {
      expect(token(`color-${name}-${(i + 1) * 100}`)).toBe(hex);
    });
  });

  it("fontes do handoff", () => {
    expect(token("font-heading")).toMatch(/^"Caprasimo"/);
    expect(token("font-body")).toMatch(/^"Figtree"/);
  });
});
