import { describe, expect, it } from "vitest";
import {
  APP_PATH,
  NAVIGATE_FALLBACK,
  NAVIGATE_FALLBACK_ALLOWLIST,
  PWA_MANIFEST,
} from "../vite.config";

describe("PWA com a landing na raiz e o app em /app/", () => {
  it("o icone instalado abre o app e o escopo cobre a landing", () => {
    expect(APP_PATH).toBe("/HomeStock/app/");
    expect(PWA_MANIFEST.id).toBe("/HomeStock/app/");
    expect(PWA_MANIFEST.start_url).toBe("/HomeStock/app/");
    expect(PWA_MANIFEST.scope).toBe("/HomeStock/");
  });

  it("navegacao perdida dentro do app cai no shell do app", () => {
    expect(NAVIGATE_FALLBACK).toBe("/HomeStock/app/index.html");
  });

  it("fora de /app/ o fallback nao entra", () => {
    const allowed = (url: string) => NAVIGATE_FALLBACK_ALLOWLIST.some((re) => re.test(url));
    expect(allowed("/HomeStock/app/")).toBe(true);
    expect(allowed("/HomeStock/app/qualquer")).toBe(true);
    expect(allowed("/HomeStock/")).toBe(false);
    expect(allowed("/HomeStock/index.html")).toBe(false);
    expect(allowed("/HomeStock/privacidade")).toBe(false);
  });
});
