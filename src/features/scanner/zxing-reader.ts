import {
  prepareZXingModule,
  purgeZXingModule,
  type ReaderOptions,
  readBarcodes,
} from "zxing-wasm/reader";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { scannedToEan } from "../../domain/model/ean";
import type { BarcodeReader } from "./reader";

/**
 * Unico modulo que conhece o zxing-wasm, carregado so por `import()` a partir
 * de `reader.ts`: o Vite o separa num chunk `zxing-reader-*.js` fora do shell.
 *
 * O teste so cobre o preparo (locateFile e purge), com o zxing-wasm trocado: a
 * escolha nativo/zxing, o erro de carga e a normalizacao do codigo vivem em
 * `reader.ts` e `ean.ts`. `happy-dom` nao tem canvas nem WebAssembly de verdade
 * para decodificar um quadro.
 */

const OPTIONS: ReaderOptions = {
  formats: ["EAN13", "EAN8", "UPCA", "UPCE"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
};
/** Lado maior do quadro entregue ao zxing: mais que isso so custa tempo por leitura. */
const MAX_SIDE = 960;

/** Entrada do `import()`: unico modulo que conhece o zxing-wasm. */
export async function createZxingReader(): Promise<BarcodeReader> {
  // O padrao do zxing-wasm busca o .wasm no jsDelivr: servico externo e quebra offline.
  try {
    await prepareZXingModule({
      overrides: {
        locateFile: (path: string, prefix: string) =>
          path.endsWith(".wasm") ? wasmUrl : prefix + path,
      },
      fireImmediately: true,
    });
  } catch (cause) {
    // O zxing-wasm guarda a promessa rejeitada do modulo; sem o purge, o "Tentar
    // de novo" so recria o modulo porque esta closure e outra a cada chamada.
    // Com o purge a nova tentativa baixa o .wasm de novo sem depender disso.
    purgeZXingModule();
    throw cause;
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Invariante: o leitor so existe num navegador com canvas 2d; nunca vai para a tela.
  if (ctx === null) throw new Error("canvas 2d indisponivel para o zxing");
  return {
    async read(video) {
      const { videoWidth: w, videoHeight: h } = video;
      if (w === 0 || h === 0) return null;
      const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      canvas.width = Math.round(w * scale);
      canvas.height = Math.round(h * scale);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const results = await readBarcodes(
        ctx.getImageData(0, 0, canvas.width, canvas.height),
        OPTIONS,
      );
      for (const result of results) {
        const ean = result.isValid ? scannedToEan(result.text) : null;
        if (ean !== null) return ean;
      }
      return null;
    },
  };
}
