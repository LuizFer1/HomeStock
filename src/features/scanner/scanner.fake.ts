import { type Mock, vi } from "vitest";
import { CameraUnsupportedError } from "./camera";
import type { ScannerEnv } from "./env";
import type { BarcodeReader } from "./reader";

export interface FakeStream {
  stream: MediaStream;
  stop: Mock;
}

/** Stream com uma track; `stop` e o espiao da track. */
export function fakeStream(): FakeStream {
  const stop = vi.fn();
  const track = { stop } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] } as unknown as MediaStream;
  return { stream, stop };
}

export interface FakeScanner {
  env: ScannerEnv;
  /** Cada openCamera bem-sucedido, na ordem. */
  streams: FakeStream[];
  /** Fila de leituras: cada read() tira a primeira; vazia devolve null. */
  codes: Array<string | null>;
  openCamera: Mock;
  attach: Mock;
  loadReader: Mock;
}

/** Camera e leitor que funcionam; `overrides` troca qualquer funcao do env. */
export function fakeScanner(overrides: Partial<ScannerEnv> = {}): FakeScanner {
  const streams: FakeStream[] = [];
  const codes: Array<string | null> = [];
  const reader: BarcodeReader = { read: async () => codes.shift() ?? null };
  const openCamera = vi.fn(
    overrides.openCamera ??
      (async () => {
        const fake = fakeStream();
        streams.push(fake);
        return fake.stream;
      }),
  );
  const attach = vi.fn(overrides.attach ?? (async () => {}));
  const loadReader = vi.fn(overrides.loadReader ?? (async () => reader));
  return {
    env: { openCamera, attach, loadReader },
    streams,
    codes,
    openCamera,
    attach,
    loadReader,
  };
}

/** Padrao do testContext: nenhuma tela de teste abre camera sem pedir. */
export function noCameraEnv(): ScannerEnv {
  return {
    openCamera: async () => Promise.reject(new CameraUnsupportedError()),
    attach: async () => {},
    loadReader: async () => ({ read: async () => null }),
  };
}
