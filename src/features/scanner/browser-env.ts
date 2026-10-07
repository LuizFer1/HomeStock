import { openCameraWith } from "./camera";
import type { ScannerEnv } from "./env";
import { cachedLoader, loadBarcodeReader, nativeDetector } from "./reader";

/**
 * Ligacao com o navegador, e so isso.
 *
 * Nao tem teste unitario porque nao tem decisao: restricoes, mensagens de erro,
 * escolha nativo/zxing e cache da carga vivem em `camera.ts` e `reader.ts`,
 * testados com fakes. `happy-dom` nao tem camera nem <video> que toca.
 */

// So referenciar navigator.mediaDevices pode lancar em contexto sandbox.
function mediaDevicesOrUndefined(): MediaDevices | undefined {
  try {
    return navigator.mediaDevices ?? undefined;
  } catch {
    return undefined;
  }
}

export function createBrowserScannerEnv(deps: { onStale: () => void }): ScannerEnv {
  return {
    openCamera: () => openCameraWith(mediaDevicesOrUndefined())(),
    async attach(video, stream) {
      // iOS so toca inline e sem som; sem isso abre em tela cheia ou nao toca.
      video.muted = true;
      video.playsInline = true;
      video.srcObject = stream;
      await video.play();
    },
    loadReader: cachedLoader(() =>
      loadBarcodeReader({
        native: nativeDetector(),
        isOnline: () => navigator.onLine,
        onStale: deps.onStale,
      }),
    ),
  };
}
