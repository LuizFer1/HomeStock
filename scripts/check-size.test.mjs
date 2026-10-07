import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isAppArtifact,
  isAppShellArtifact,
  isFontArtifact,
  isLandingArtifact,
  isScannerArtifact,
  LANDING_LIMIT_BYTES,
  measureDist,
} from "./check-size.mjs";

describe("check-size", () => {
  it("mede JS e CSS do shell", () => {
    expect(isAppShellArtifact("assets/index-abc.js")).toBe(true);
    expect(isAppShellArtifact("assets/index-abc.css")).toBe(true);
  });

  it("deixa o service worker de fora", () => {
    expect(isAppShellArtifact("sw.js")).toBe(false);
    expect(isAppShellArtifact("workbox-1234.js")).toBe(false);
    expect(isAppShellArtifact("registerSW.js")).toBe(false);
  });

  it("fontes so woff2", () => {
    expect(isFontArtifact("assets/figtree-latin-400-normal-x.woff2")).toBe(true);
    expect(isFontArtifact("assets/figtree-latin-400-normal-x.woff")).toBe(false);
    expect(isAppShellArtifact("assets/figtree-latin-400-normal-x.woff2")).toBe(false);
  });

  it("reconhece o chunk e o .wasm do leitor", () => {
    expect(isScannerArtifact("assets/zxing-reader-AbC_1.js")).toBe(true);
    expect(isScannerArtifact("assets/zxing_reader-AbC1.wasm")).toBe(true);
    expect(isScannerArtifact("assets/index-AbC.js")).toBe(false);
  });

  it("o app nao mede o leitor; o leitor tem orcamento proprio", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "check-size-"));
    try {
      await mkdir(path.join(dir, "assets"));
      await writeFile(path.join(dir, "assets", "index-AbC.js"), "console.log(1)");
      await writeFile(path.join(dir, "assets", "zxing-reader-AbC_1.js"), "console.log(2)");
      await writeFile(path.join(dir, "assets", "zxing_reader-AbC1.wasm"), "wasm");

      const app = await measureDist(dir);
      expect(app.files.map((f) => f.file)).toEqual([path.join("assets", "index-AbC.js")]);
      expect(isAppArtifact("assets/zxing-reader-AbC_1.js")).toBe(false);

      const scanner = await measureDist(dir, isScannerArtifact);
      expect(scanner.files.map((f) => f.file).sort()).toEqual([
        path.join("assets", "zxing-reader-AbC_1.js"),
        path.join("assets", "zxing_reader-AbC1.wasm"),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("a landing tem teto proprio de 25kb", () => {
    expect(LANDING_LIMIT_BYTES).toBe(25 * 1024);
  });

  it("reconhece os artefatos da landing", () => {
    expect(isLandingArtifact("assets/landing-AbC.js")).toBe(true);
    expect(isLandingArtifact("assets/landing-AbC.css")).toBe(true);
    expect(isLandingArtifact("assets/landing-qr-AbC.js")).toBe(true);
    expect(isLandingArtifact("assets/app-AbC.js")).toBe(false);
    expect(isLandingArtifact("assets/landing-AbC.woff2")).toBe(false);
  });

  it("o app nao mede a landing", () => {
    expect(isAppArtifact("assets/landing-AbC.js")).toBe(false);
    expect(isAppArtifact("assets/app-AbC.js")).toBe(true);
  });

  it("separa os orcamentos do app e da landing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "check-size-"));
    try {
      await mkdir(path.join(dir, "assets"));
      for (const name of ["app-1.js", "landing-1.js", "landing-1.css", "landing-qr-1.js"]) {
        await writeFile(path.join(dir, "assets", name), "console.log(1)");
      }

      const app = await measureDist(dir);
      expect(app.files.map((f) => f.file)).toEqual([path.join("assets", "app-1.js")]);

      const landing = await measureDist(dir, isLandingArtifact);
      expect(landing.files.map((f) => f.file).sort()).toEqual([
        path.join("assets", "landing-1.css"),
        path.join("assets", "landing-1.js"),
        path.join("assets", "landing-qr-1.js"),
      ]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
