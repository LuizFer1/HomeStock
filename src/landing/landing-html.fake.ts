import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** O index.html da landing como Document, para testar o markup sem build. */
export function loadLanding(): Document {
  const html = readFileSync(resolve(import.meta.dirname, "../../index.html"), "utf8");
  return new DOMParser().parseFromString(html, "text/html");
}

/** Texto visivel com espacos normalizados. */
export function textOf(el: Element | null | undefined): string | undefined {
  return el?.textContent?.replace(/\s+/g, " ").trim();
}
