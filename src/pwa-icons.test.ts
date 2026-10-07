import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { MANIFEST_ICONS } from "../vite.config";

/** Largura e altura do cabecalho IHDR do PNG. */
function pngSize(file: string): string {
  const bytes = readFileSync(file);
  return `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}`;
}

describe("icones do manifest", () => {
  it.each(MANIFEST_ICONS)("$src existe com o tamanho declarado", (icon) => {
    expect(pngSize(resolve(import.meta.dirname, "../public", icon.src))).toBe(icon.sizes);
  });

  it("tem any e maskable", () => {
    expect(new Set(MANIFEST_ICONS.map((i) => i.purpose))).toEqual(new Set(["any", "maskable"]));
  });
});
