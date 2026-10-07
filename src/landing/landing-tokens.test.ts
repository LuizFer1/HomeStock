import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const read = (file: string) => readFileSync(resolve(import.meta.dirname, file), "utf8");

/** `--color-x: valor;` de um trecho de CSS, na ordem em que aparecem. */
function tokens(css: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const [, name, value] of css.matchAll(/(--color-[\w-]+):\s*([^;]+);/g)) {
    if (name && value && !out.has(name)) out.set(name, value.trim());
  }
  return out;
}

/*
 * A landing copia as cores do app em vez de importar o app.css (Tailwind inteiro).
 * Copia sem conferencia desalinha em silencio no proximo ajuste de paleta.
 */
it("toda cor da landing e a mesma do app", () => {
  const app = tokens(read("../styles/tokens.css"));
  const landing = tokens(read("landing.css"));
  expect(landing.size).toBeGreaterThan(30);
  for (const [name, value] of landing) {
    expect(app.get(name), name).toBe(value);
  }
});
