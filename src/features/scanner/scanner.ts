import { type ReadonlySignal, signal } from "@preact/signals";
import { cameraErrorMessage, stopStream } from "./camera";
import type { ScannerEnv } from "./env";
import type { BarcodeReader } from "./reader";

/** Um quadro a cada 200 ms: rapido para a pessoa, leve para a bateria. */
export const SCAN_INTERVAL_MS = 200;

export type ScanState =
  | { phase: "idle" }
  | { phase: "starting" }
  | { phase: "scanning" }
  | { phase: "error"; message: string; retry: boolean };

export interface ScannerOptions {
  env: ScannerEnv;
  video: () => HTMLVideoElement | null;
  /** Codigo ja normalizado. O scanner ja parou a camera quando isto roda. */
  onCode: (ean: string) => void;
}

export interface Scanner {
  state: ReadonlySignal<ScanState>;
  /** Abre camera e leitor em paralelo e le a cada 200 ms. Ignorado em starting/scanning. */
  start: () => Promise<void>;
  /** Para tracks, laco e qualquer abertura em voo. Volta a idle; um erro mostrado fica. */
  stop: () => void;
}

/** Converte um throw sincrono do env em rejeicao: tudo passa pelo mesmo caminho de erro. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

export function createScanner({ env, video, onCode }: ScannerOptions): Scanner {
  const state = signal<ScanState>({ phase: "idle" });
  // Ticket do projeto: cada start/stop cria uma geracao; resposta de outra geracao e velha.
  let generation = 0;
  let current: MediaStream | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Desliga tudo o que esta aberto: tracks (luz da camera), laco e o video. */
  function halt(): void {
    clearTimeout(timer);
    timer = undefined;
    if (current !== null) stopStream(current);
    current = null;
    const el = video();
    if (el !== null) {
      try {
        el.srcObject = null;
      } catch {
        // Ambiente sem srcObject: nada a soltar.
      }
    }
  }

  function fail(cause: unknown): void {
    halt();
    state.value = { phase: "error", ...cameraErrorMessage(cause) };
  }

  function schedule(gen: number, reader: BarcodeReader): void {
    timer = setTimeout(() => void tick(gen, reader), SCAN_INTERVAL_MS);
  }

  async function tick(gen: number, reader: BarcodeReader): Promise<void> {
    const el = video();
    if (gen !== generation) return;
    if (el === null) {
      // O video saiu do DOM sem stop: nao deixa a camera ligada sem tela.
      halt();
      state.value = { phase: "idle" };
      return;
    }
    // Quadro sem imagem ou falha do leitor: so mais uma tentativa.
    const code = await call(() => reader.read(el)).catch(() => null);
    if (gen !== generation) return;
    if (code !== null) {
      // Para antes de entregar: evita ler o mesmo pacote de novo e apaga a luz ja.
      halt();
      state.value = { phase: "idle" };
      try {
        onCode(code);
      } catch (cause) {
        // tick roda num setTimeout sem dono: um throw aqui viraria rejeicao nao tratada.
        // Relanca fora da promise para o erro chegar ao handler global como erro comum.
        queueMicrotask(() => {
          throw cause;
        });
      }
      return;
    }
    // O proximo so depois deste terminar: o zxing pode passar de 200 ms num aparelho fraco.
    schedule(gen, reader);
  }

  async function start(): Promise<void> {
    const { phase } = state.value;
    if (phase === "starting" || phase === "scanning") return;
    generation += 1;
    const gen = generation;
    state.value = { phase: "starting" };

    const [camera, loaded] = await Promise.allSettled([call(env.openCamera), call(env.loadReader)]);
    if (gen !== generation) {
      // Saiu da tela durante a abertura: o stream que chegou agora nao tem dono.
      if (camera.status === "fulfilled") stopStream(camera.value);
      return;
    }
    // O motivo da camera vem primeiro: sem camera, o leitor nao importa.
    if (camera.status === "rejected") {
      state.value = { phase: "error", ...cameraErrorMessage(camera.reason) };
      return;
    }
    if (loaded.status === "rejected") {
      stopStream(camera.value);
      state.value = { phase: "error", ...cameraErrorMessage(loaded.reason) };
      return;
    }
    const el = video();
    if (el === null) {
      stopStream(camera.value);
      state.value = { phase: "idle" };
      return;
    }
    const stream = camera.value;

    current = stream;
    try {
      await env.attach(el, stream);
    } catch (cause) {
      // O play() interrompido por stop rejeita com AbortError; mostrar "camera ocupada"
      // por isso seria mentira: o stop ja limpou tudo, o erro e velho.
      if (gen !== generation) return;
      fail(cause);
      return;
    }
    if (gen !== generation) return;
    state.value = { phase: "scanning" };
    schedule(gen, loaded.value);
  }

  function stop(): void {
    generation += 1;
    halt();
    if (state.value.phase !== "error") state.value = { phase: "idle" };
  }

  return { state, start, stop };
}
