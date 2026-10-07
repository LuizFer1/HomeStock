import { describe, expect, it, vi } from "vitest";
import {
  type BarcodeDetectorCtor,
  type BarcodeReader,
  cachedLoader,
  loadBarcodeReader,
  type ReaderDeps,
  ScannerUnavailableError,
} from "./reader";

const VIDEO = {} as HTMLVideoElement;

/** BarcodeDetector falso: formatos suportados e o que `detect` devolve. */
function fakeNative(
  supported: Promise<string[]>,
  detect: () => Promise<Array<{ rawValue: string }>> = async () => [],
) {
  const built: Array<{ formats: string[] }> = [];
  const Ctor = class {
    detect = detect;
    constructor(options: { formats: string[] }) {
      built.push(options);
    }
    static getSupportedFormats = () => supported;
  } as unknown as BarcodeDetectorCtor;
  return { Ctor, built };
}

const zxingReader: BarcodeReader = { read: async () => "7891000100103" };

function deps(overrides: Partial<ReaderDeps> = {}) {
  const loadZxing = vi.fn(async () => ({ createZxingReader: async () => zxingReader }));
  const onStale = vi.fn();
  const all: ReaderDeps = {
    native: undefined,
    loadZxing,
    isOnline: () => true,
    onStale,
    ...overrides,
  };
  return { deps: all, loadZxing, onStale };
}

describe("loadBarcodeReader", () => {
  it("usa o nativo quando ha ean_13, so com os formatos de mercado", async () => {
    const { Ctor, built } = fakeNative(Promise.resolve(["ean_13", "qr_code"]));
    const d = deps({ native: Ctor });
    const reader = await loadBarcodeReader(d.deps);
    expect(reader).not.toBe(zxingReader);
    expect(built).toEqual([{ formats: ["ean_13"] }]);
    expect(d.loadZxing).not.toHaveBeenCalled();
  });

  it("nativo sem ean_13 cai no zxing", async () => {
    const { Ctor } = fakeNative(Promise.resolve(["qr_code"]));
    const d = deps({ native: Ctor });
    await expect(loadBarcodeReader(d.deps)).resolves.toBe(zxingReader);
    expect(d.loadZxing).toHaveBeenCalledOnce();
  });

  it("sem nativo usa o zxing", async () => {
    const d = deps();
    await expect(loadBarcodeReader(d.deps)).resolves.toBe(zxingReader);
  });

  it("getSupportedFormats que rejeita cai no zxing", async () => {
    const { Ctor } = fakeNative(Promise.reject(new Error("x")));
    const d = deps({ native: Ctor });
    await expect(loadBarcodeReader(d.deps)).resolves.toBe(zxingReader);
  });

  it("read nativo normaliza o codigo lido", async () => {
    const { Ctor } = fakeNative(Promise.resolve(["ean_13"]), async () => [
      { rawValue: "036000291452" },
    ]);
    const reader = await loadBarcodeReader(deps({ native: Ctor }).deps);
    await expect(reader.read(VIDEO)).resolves.toBe("0036000291452");
  });

  it("read nativo com leitura ruim devolve null", async () => {
    const { Ctor } = fakeNative(Promise.resolve(["ean_13"]), async () => [{ rawValue: "abc" }]);
    const reader = await loadBarcodeReader(deps({ native: Ctor }).deps);
    await expect(reader.read(VIDEO)).resolves.toBeNull();
  });

  it("read nativo com detect que lanca devolve null", async () => {
    const { Ctor } = fakeNative(Promise.resolve(["ean_13"]), async () => {
      throw new DOMException("x", "InvalidStateError");
    });
    const reader = await loadBarcodeReader(deps({ native: Ctor }).deps);
    await expect(reader.read(VIDEO)).resolves.toBeNull();
  });

  it("import do zxing que falha offline: indisponivel offline, sem procurar versao", async () => {
    const cause = new Error("Failed to fetch dynamically imported module");
    const d = deps({ isOnline: () => false, loadZxing: vi.fn(async () => Promise.reject(cause)) });
    const error = await loadBarcodeReader(d.deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScannerUnavailableError);
    expect((error as ScannerUnavailableError).offline).toBe(true);
    expect((error as ScannerUnavailableError).name).toBe("ScannerUnavailableError");
    expect((error as ScannerUnavailableError).cause).toBe(cause);
    expect(d.onStale).not.toHaveBeenCalled();
  });

  it("import do zxing que falha online: versao velha, procura a nova uma vez", async () => {
    const d = deps({ loadZxing: vi.fn(async () => Promise.reject(new Error("404"))) });
    const error = await loadBarcodeReader(d.deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScannerUnavailableError);
    expect((error as ScannerUnavailableError).offline).toBe(false);
    expect(d.onStale).toHaveBeenCalledOnce();
  });

  it("falha do .wasm (createZxingReader) tambem e leitor indisponivel", async () => {
    const d = deps({
      loadZxing: vi.fn(async () => ({
        createZxingReader: async () => Promise.reject(new Error("wasm")),
      })),
    });
    const error = await loadBarcodeReader(d.deps).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ScannerUnavailableError);
    expect((error as ScannerUnavailableError).offline).toBe(false);
    expect(d.onStale).toHaveBeenCalledOnce();
  });

  it("falha do .wasm offline: indisponivel offline, sem procurar versao", async () => {
    const d = deps({
      isOnline: () => false,
      loadZxing: vi.fn(async () => ({
        createZxingReader: async () => Promise.reject(new Error("wasm")),
      })),
    });
    const error = await loadBarcodeReader(d.deps).catch((e: unknown) => e);
    expect((error as ScannerUnavailableError).offline).toBe(true);
    expect(d.onStale).not.toHaveBeenCalled();
  });
});

describe("cachedLoader", () => {
  it("carrega uma vez por sessao", async () => {
    const load = vi.fn(async () => zxingReader);
    const get = cachedLoader(load);
    const [a, b] = await Promise.all([get(), get()]);
    expect(a).toBe(zxingReader);
    expect(b).toBe(zxingReader);
    await get();
    expect(load).toHaveBeenCalledOnce();
  });

  it("carga que falhou e esquecida: a proxima carrega de novo", async () => {
    const load = vi
      .fn<() => Promise<BarcodeReader>>()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(zxingReader);
    const get = cachedLoader(load);
    await expect(get()).rejects.toThrow("offline");
    await expect(get()).resolves.toBe(zxingReader);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
