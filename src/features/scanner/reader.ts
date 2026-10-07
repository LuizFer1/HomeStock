import { scannedToEan } from "../../domain/model/ean";

export interface BarcodeReader {
  /** Le um quadro do video. Codigo ja normalizado por scannedToEan, ou null. */
  read: (video: HTMLVideoElement) => Promise<string | null>;
}

/** Codigos de produto de mercado; QR e Code 128 ficam fora. */
export const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"] as const;

/** O pedaco da API Shape Detection que usamos; nao esta no lib.dom do TypeScript. */
export interface BarcodeDetectorCtor {
  new (options: {
    formats: string[];
  }): {
    detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
  };
  getSupportedFormats: () => Promise<string[]>;
}

/** So o tipo: o valor chega pelo `import()` de `loadZxing`. */
type ZxingModule = typeof import("./zxing-reader");

/**
 * O `import()` do leitor (ou o .wasm dele) falhou. Offline na primeira vez, ele
 * ainda nao foi baixado; online, a aba roda uma versao que o servidor ja nao tem.
 */
export class ScannerUnavailableError extends Error {
  readonly offline: boolean;

  constructor(offline: boolean, cause: unknown) {
    super(offline ? "leitor zxing nao baixado (offline)" : "leitor zxing ausente no servidor", {
      cause,
    });
    this.name = "ScannerUnavailableError";
    this.offline = offline;
  }
}

export interface ReaderDeps {
  /** `globalThis.BarcodeDetector`, ou undefined. */
  native: BarcodeDetectorCtor | undefined;
  /** Injetado no teste; em producao e o `import()` que separa o zxing do shell. */
  loadZxing?: () => Promise<Pick<ZxingModule, "createZxingReader">>;
  isOnline: () => boolean;
  /** A versao aberta se mostrou velha: hora de procurar a nova. */
  onStale: () => void;
}

/** Le `globalThis.BarcodeDetector` com try/catch (contexto sandbox lanca no getter). */
export function nativeDetector(): BarcodeDetectorCtor | undefined {
  try {
    const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    return typeof ctor === "function" ? ctor : undefined;
  } catch {
    return undefined;
  }
}

/** Nativo com ean_13; senao zxing sob demanda. */
export async function loadBarcodeReader(deps: ReaderDeps): Promise<BarcodeReader> {
  const { native } = deps;
  if (native !== undefined) {
    const supported = await native.getSupportedFormats().catch(() => [] as string[]);
    const formats: string[] = NATIVE_FORMATS.filter((f) => supported.includes(f));
    // Sem ean_13 o nativo nao serve para mercado; o zxing le todos.
    if (formats.includes("ean_13")) {
      const detector = new native({ formats });
      return {
        async read(video) {
          let barcodes: Array<{ rawValue: string }>;
          try {
            barcodes = await detector.detect(video);
          } catch {
            // detect lanca enquanto o video ainda nao tem quadro: so mais uma tentativa.
            return null;
          }
          for (const barcode of barcodes) {
            const ean = scannedToEan(barcode.rawValue);
            if (ean !== null) return ean;
          }
          return null;
        },
      };
    }
  }

  const load = deps.loadZxing ?? (() => import("./zxing-reader"));
  try {
    // O createZxingReader fica dentro do try: a falha do .wasm e a mesma situacao do import.
    return await (await load()).createZxingReader();
  } catch (cause) {
    const offline = !deps.isOnline();
    if (!offline) deps.onStale();
    throw new ScannerUnavailableError(offline, cause);
  }
}

/** Uma carga por sessao; carga que falhou e esquecida, para "Tentar de novo" carregar outra vez. */
export function cachedLoader(load: () => Promise<BarcodeReader>): () => Promise<BarcodeReader> {
  let pending: Promise<BarcodeReader> | null = null;
  return () => {
    if (pending === null) {
      const attempt = load();
      pending = attempt;
      attempt.catch(() => {
        if (pending === attempt) pending = null;
      });
    }
    return pending;
  };
}
