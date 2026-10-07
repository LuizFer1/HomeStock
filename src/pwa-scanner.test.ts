import { describe, expect, it } from "vitest";
import { isScannerArtifact } from "../scripts/check-size.mjs";
import { SCANNER_CACHE, SCANNER_GLOB_IGNORES } from "../vite.config";
import { CACHE_ID } from "./features/settings/reset-scope";

const READER_JS = "/HomeStock/assets/zxing-reader-AbC_1.js";
const READER_WASM = "/HomeStock/assets/zxing_reader-AbC1.wasm";

describe("leitor zxing no PWA", () => {
  it("o cache de runtime pega o chunk e o .wasm do leitor, e so eles", () => {
    expect(SCANNER_CACHE.urlPattern.test(READER_JS)).toBe(true);
    expect(SCANNER_CACHE.urlPattern.test(READER_WASM)).toBe(true);
    expect(SCANNER_CACHE.urlPattern.test("/HomeStock/assets/index-AbC.js")).toBe(false);
  });

  it("CacheFirst num cache que o sair da casa apaga", () => {
    expect(SCANNER_CACHE.handler).toBe("CacheFirst");
    expect(SCANNER_CACHE.options.cacheName).toContain(CACHE_ID);
  });

  it("o que o cache pega e o que o orcamento do leitor mede", () => {
    expect(isScannerArtifact(READER_JS.replace("/HomeStock/", ""))).toBe(true);
    expect(isScannerArtifact(READER_WASM.replace("/HomeStock/", ""))).toBe(true);
  });

  it("os dois artefatos ficam fora do precache", () => {
    expect(SCANNER_GLOB_IGNORES).toEqual(["**/zxing-reader-*.js", "**/zxing_reader-*.wasm"]);
  });
});
