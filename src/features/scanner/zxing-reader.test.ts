import { afterEach, describe, expect, it, vi } from "vitest";

// Modulo do zxing-wasm trocado: nenhum .wasm de verdade e carregado no teste.
const zxing = vi.hoisted(() => ({
  prepareZXingModule: vi.fn(),
  purgeZXingModule: vi.fn(),
  readBarcodes: vi.fn(),
}));
vi.mock("zxing-wasm/reader", () => zxing);
vi.mock("zxing-wasm/reader/zxing_reader.wasm?url", () => ({
  default: "/HomeStock/assets/zxing_reader-AbC1.wasm",
}));

import { createZxingReader } from "./zxing-reader";

afterEach(() => {
  vi.clearAllMocks();
});

describe("createZxingReader", () => {
  it("o .wasm vem do proprio build, nunca do CDN padrao", async () => {
    zxing.prepareZXingModule.mockResolvedValueOnce({});
    // happy-dom nao tem canvas 2d: o preparo e o que interessa aqui.
    await createZxingReader().catch(() => {});
    expect(zxing.prepareZXingModule).toHaveBeenCalledOnce();
    const options = zxing.prepareZXingModule.mock.calls[0]?.[0] as {
      overrides: { locateFile: (path: string, prefix: string) => string };
    };
    expect(options.overrides.locateFile("zxing_reader.wasm", "https://x/")).toBe(
      "/HomeStock/assets/zxing_reader-AbC1.wasm",
    );
  });

  it("preparo que falha esquece o modulo antes de relancar", async () => {
    const cause = new Error("wasm 404");
    zxing.prepareZXingModule.mockRejectedValueOnce(cause);
    await expect(createZxingReader()).rejects.toBe(cause);
    expect(zxing.purgeZXingModule).toHaveBeenCalledOnce();
  });
});
