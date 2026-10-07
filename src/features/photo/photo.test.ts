import { describe, expect, it, vi } from "vitest";
import { AVATAR_PHOTO, type PhotoDeps, processPhoto, QUALITIES, squareCrop } from "./photo";

function deps(lengths: number[]) {
  const encode = vi.fn(async (_s, _c, _size, quality: number) => {
    const index = QUALITIES.indexOf(quality as (typeof QUALITIES)[number]);
    return "x".repeat(lengths[index] ?? 0);
  });
  const decode = vi.fn(async () => ({ width: 400, height: 300 }));
  return { decode, encode } satisfies PhotoDeps;
}

describe("squareCrop", () => {
  it("paisagem corta as laterais", () => {
    expect(squareCrop(400, 300)).toEqual({ x: 50, y: 0, size: 300 });
  });

  it("retrato corta em cima e embaixo", () => {
    expect(squareCrop(300, 400)).toEqual({ x: 0, y: 50, size: 300 });
  });
});

describe("processPhoto", () => {
  const spec = { size: 160, maxChars: 100 };

  it("decodifica uma vez so", async () => {
    const d = deps([500, 500, 50]);
    await processPhoto(new Blob(), d, spec);
    expect(d.decode).toHaveBeenCalledTimes(1);
  });

  it("devolve a primeira qualidade que cabe", async () => {
    const d = deps([50, 10, 5]);
    expect((await processPhoto(new Blob(), d, spec)).length).toBe(50);
    expect(d.encode).toHaveBeenCalledTimes(1);
  });

  it("tenta 0.8, 0.6 e 0.45 nessa ordem", async () => {
    const d = deps([500, 500, 50]);
    await processPhoto(new Blob(), d, spec);
    expect(d.encode.mock.calls.map((call) => call[3])).toEqual([0.8, 0.6, 0.45]);
  });

  it("lanca quando nenhuma cabe", async () => {
    const d = deps([500, 500, 500]);
    await expect(processPhoto(new Blob(), d, spec)).rejects.toThrow(
      "Essa imagem é grande demais. Tente uma foto mais simples ou menor.",
    );
  });

  it("passa o tamanho da spec ao encode", async () => {
    const d = deps([5, 5, 5]);
    await processPhoto(new Blob(), d, AVATAR_PHOTO);
    expect(d.encode.mock.calls[0]?.[2]).toBe(160);
  });
});
