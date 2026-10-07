import type { BarcodeReader } from "./reader";

/** Tudo do navegador que o scanner usa; o teste troca por fakes. */
export interface ScannerEnv {
  openCamera: () => Promise<MediaStream>;
  /** Liga o stream ao <video> (muted, playsInline) e espera tocar. */
  attach: (video: HTMLVideoElement, stream: MediaStream) => Promise<void>;
  loadReader: () => Promise<BarcodeReader>;
}
