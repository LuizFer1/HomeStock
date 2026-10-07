import { describe, expect, it } from "vitest";
import { qrSvg } from "./landing-qr";
import { pixPayload } from "./pix";

const payload5 = pixPayload({
  key: "cafe@homestock.app",
  name: "HomeStock",
  city: "SAO PAULO",
  amount: 5,
});

describe("qrSvg", () => {
  it("gera um SVG de 49 modulos, escuro e sem suavizacao", () => {
    const svg = qrSvg(payload5);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).toContain('viewBox="0 0 49 49"');
    expect(svg).toContain('fill="#201e1d"');
    expect(svg).toContain('shape-rendering="crispEdges"');
  });

  it("payloads diferentes dao SVGs diferentes", () => {
    const payload10 = payload5.replace("5.00", "10.00");
    expect(qrSvg(payload5)).not.toBe(qrSvg(payload10));
  });
});
