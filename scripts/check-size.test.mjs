import { describe, expect, it } from "vitest";
import { isAppShellArtifact, isFontArtifact } from "./check-size.mjs";

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
});
