import { describe, expect, it } from "vitest";
import { qrSvg } from "./landing-qr";

const payload5 = "https://exemplo.app/homestock/app/";

describe("qrSvg", () => {
  it("gera um SVG quadrado, escuro e sem suavizacao", () => {
    const svg = qrSvg(payload5);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toMatch(/viewBox="0 0 (\d+) \1"/);
    expect(svg).toContain('fill="#201e1d"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it("payloads diferentes dao SVGs diferentes", () => {
    const outro = `${payload5}?x=1`;
    expect(qrSvg(payload5)).not.toBe(qrSvg(outro));
  });
});
