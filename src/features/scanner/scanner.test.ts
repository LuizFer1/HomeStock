import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScannerUnavailableError } from "./reader";
import { createScanner, SCAN_INTERVAL_MS } from "./scanner";
import { fakeScanner, fakeStream } from "./scanner.fake";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const EAN = "7891234567890";

/** Promise que o teste resolve ou rejeita quando quiser. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (cause: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(fake = fakeScanner()) {
  const video = document.createElement("video");
  const onCode = vi.fn();
  const scanner = createScanner({ env: fake.env, video: () => video, onCode });
  return { fake, video, onCode, scanner };
}

describe("createScanner", () => {
  it("abre camera, leitor e video uma vez e passa a ler", async () => {
    const { fake, video, scanner } = setup();
    expect(scanner.state.value).toEqual({ phase: "idle" });
    const started = scanner.start();
    expect(scanner.state.value).toEqual({ phase: "starting" });
    await started;
    expect(scanner.state.value).toEqual({ phase: "scanning" });
    expect(fake.openCamera).toHaveBeenCalledTimes(1);
    expect(fake.loadReader).toHaveBeenCalledTimes(1);
    expect(fake.attach).toHaveBeenCalledTimes(1);
    expect(fake.attach).toHaveBeenCalledWith(video, fake.streams[0]?.stream);
  });

  it("le a cada 200 ms e para a track antes de entregar o codigo", async () => {
    const { fake, video, onCode, scanner } = setup();
    fake.codes.push(null, EAN);
    await scanner.start();
    // O happy-dom recusa stream falso no srcObject; uma propriedade simples faz o papel do attach.
    Object.defineProperty(video, "srcObject", {
      value: fake.streams[0]?.stream,
      writable: true,
      configurable: true,
    });
    expect(video.srcObject).not.toBeNull();
    const order: string[] = [];
    fake.streams[0]?.stop.mockImplementation(() => order.push("stop"));
    onCode.mockImplementation(() => order.push("onCode"));

    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).toHaveBeenCalledWith(EAN);
    expect(order).toEqual(["stop", "onCode"]);
    expect(scanner.state.value).toEqual({ phase: "idle" });
    expect(video.srcObject).toBeNull();
  });

  it("start duas vezes seguidas abre uma camera so", async () => {
    const { fake, scanner } = setup();
    await Promise.all([scanner.start(), scanner.start()]);
    expect(fake.openCamera).toHaveBeenCalledTimes(1);
  });

  it("stop durante a abertura para o stream que chega depois sem tocar no video", async () => {
    const pending = deferred<MediaStream>();
    const fake = fakeScanner({ openCamera: () => pending.promise });
    const { scanner } = setup(fake);
    const started = scanner.start();
    scanner.stop();
    expect(scanner.state.value).toEqual({ phase: "idle" });
    const late = fakeStream();
    pending.resolve(late.stream);
    await started;
    expect(late.stop).toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
    expect(scanner.state.value).toEqual({ phase: "idle" });
  });

  it("descarta o erro do play interrompido por stop (AbortError velho)", async () => {
    const playing = deferred<void>();
    const fake = fakeScanner({ attach: () => playing.promise });
    const { scanner } = setup(fake);
    const started = scanner.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(fake.attach).toHaveBeenCalledTimes(1);
    scanner.stop();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    playing.reject(new DOMException("interrompido", "AbortError"));
    await started;
    expect(scanner.state.value).toEqual({ phase: "idle" });
  });

  it("attach que falha sem stop para a track e mostra o erro", async () => {
    const fake = fakeScanner({
      attach: async () => Promise.reject(new DOMException("ocupada", "NotReadableError")),
    });
    const { scanner } = setup(fake);
    await scanner.start();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(scanner.state.value).toMatchObject({ phase: "error", retry: true });
  });

  it("leitor offline com a camera aberta para a track e pede para tentar de novo", async () => {
    const fake = fakeScanner({
      loadReader: async () => Promise.reject(new ScannerUnavailableError(true, null)),
    });
    const { scanner } = setup(fake);
    await scanner.start();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
    expect(scanner.state.value).toEqual({
      phase: "error",
      message:
        "O leitor de código ainda não foi baixado. Conecte-se à internet uma vez ou digite o código no campo abaixo.",
      retry: true,
    });
  });

  it("permissao negada vira a mensagem de permissao", async () => {
    const fake = fakeScanner({
      openCamera: async () => Promise.reject(new DOMException("nao", "NotAllowedError")),
      loadReader: async () => Promise.reject(new ScannerUnavailableError(true, null)),
    });
    const { scanner } = setup(fake);
    await scanner.start();
    expect(scanner.state.value).toEqual({
      phase: "error",
      message:
        "Sem permissão para usar a câmera. Libere nas configurações do navegador ou digite o código no campo abaixo.",
      retry: true,
    });
  });

  it("read que lanca conta como null e o laco segue", async () => {
    let calls = 0;
    const read = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error("quadro vazio");
      return EAN;
    });
    const fake = fakeScanner({ loadReader: async () => ({ read }) });
    const { onCode, scanner } = setup(fake);
    await scanner.start();
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).not.toHaveBeenCalled();
    expect(scanner.state.value).toEqual({ phase: "scanning" });
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(onCode).toHaveBeenCalledWith(EAN);
  });

  it("um read lento nao dispara outro antes de terminar", async () => {
    const slow = deferred<string | null>();
    const read = vi.fn(() => slow.promise);
    const fake = fakeScanner({ loadReader: async () => ({ read }) });
    const { scanner } = setup(fake);
    await scanner.start();
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS * 5);
    expect(read).toHaveBeenCalledTimes(1);
    slow.resolve(null);
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("stop durante a leitura para a track e o laco", async () => {
    const { fake, scanner } = setup();
    await scanner.start();
    scanner.stop();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(scanner.state.value).toEqual({ phase: "idle" });
    fake.codes.push(EAN);
    await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS * 3);
    expect(fake.codes).toEqual([EAN]);
  });

  it("stop depois de um erro mantem o erro", async () => {
    const fake = fakeScanner({
      openCamera: async () => Promise.reject(new DOMException("nao", "NotAllowedError")),
    });
    const { scanner } = setup(fake);
    await scanner.start();
    scanner.stop();
    expect(scanner.state.value).toMatchObject({ phase: "error" });
  });

  it("sem video montado para o stream e volta a idle", async () => {
    const fake = fakeScanner();
    const scanner = createScanner({ env: fake.env, video: () => null, onCode: vi.fn() });
    await scanner.start();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
    expect(scanner.state.value).toEqual({ phase: "idle" });
  });
});
