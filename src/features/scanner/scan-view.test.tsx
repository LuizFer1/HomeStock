import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanView } from "./scan-view";
import { SCAN_INTERVAL_MS } from "./scanner";
import { fakeScanner, fakeStream, noCameraEnv } from "./scanner.fake";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  // Volta ao getter do prototipo (o happy-dom diz "visible").
  Reflect.deleteProperty(document, "visibilityState");
});

const EAN = "7891234567890";

function setVisibility(value: "hidden" | "visible") {
  Object.defineProperty(document, "visibilityState", { value, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

function video(): HTMLVideoElement {
  const el = document.querySelector("video");
  if (el === null) throw new Error("sem video");
  return el;
}

/** Promise que o teste resolve quando quiser. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** Deixa as promises da abertura (camera, leitor, attach) assentarem. */
async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
}

describe("ScanView", () => {
  it("abre ao montar: legenda de abertura e depois a de leitura", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    expect(screen.getByRole("group", { name: "Leitor de código de barras" })).toBeTruthy();
    expect(screen.getByText("Abrindo a câmera…")).toBeTruthy();
    // Abrindo: invisivel, mas com layout para o play().
    expect(video().classList.contains("opacity-0")).toBe(true);
    expect(video().classList.contains("hidden")).toBe(false);
    await settle();
    expect(screen.getByText("Aponte para o código de barras")).toBeTruthy();
    expect(video().classList.contains("opacity-0")).toBe(false);
    expect(video().classList.contains("hidden")).toBe(false);
    expect(fake.openCamera).toHaveBeenCalledTimes(1);
  });

  it("parado o video sai do layout", () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart={false} idleLabel="Ler código" onCode={vi.fn()} />);
    expect(video().classList.contains("hidden")).toBe(true);
  });

  it("Ler código leva o foco ao visor, ja que o botao some", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart={false} idleLabel="Ler código" onCode={vi.fn()} />);
    const button = screen.getByRole("button", { name: "Ler código" });
    button.focus();
    fireEvent.click(button);
    await settle();
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Leitor de código de barras" }),
    );
  });

  it("esconder durante a abertura e voltar abre de novo", async () => {
    const pending = deferred<MediaStream>();
    const late = fakeStream();
    const fresh = fakeStream();
    const openCamera = vi
      .fn<() => Promise<MediaStream>>()
      .mockReturnValueOnce(pending.promise)
      .mockResolvedValueOnce(fresh.stream);
    const fake = fakeScanner({ openCamera });
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    act(() => setVisibility("hidden"));
    pending.resolve(late.stream);
    await settle();
    expect(late.stop).toHaveBeenCalled();
    act(() => setVisibility("visible"));
    await settle();
    expect(openCamera).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Aponte para o código de barras")).toBeTruthy();
    expect(fresh.stop).not.toHaveBeenCalled();
  });

  it("desmontar com a camera ainda abrindo para o stream que chega depois", async () => {
    const pending = deferred<MediaStream>();
    const late = fakeStream();
    const fake = fakeScanner({ openCamera: () => pending.promise });
    const { unmount } = render(
      <ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />,
    );
    unmount();
    pending.resolve(late.stream);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(late.stop).toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
  });

  it("pagehide durante a abertura para o stream que chega depois", async () => {
    const pending = deferred<MediaStream>();
    const late = fakeStream();
    const fake = fakeScanner({ openCamera: () => pending.promise });
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    pending.resolve(late.stream);
    await settle();
    expect(late.stop).toHaveBeenCalled();
    expect(fake.attach).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ler código" })).toBeTruthy();
  });

  it("lido um codigo chama onCode, para a track e mostra o botao", async () => {
    const fake = fakeScanner();
    fake.codes.push(EAN);
    const onCode = vi.fn();
    render(<ScanView env={fake.env} autoStart idleLabel="Ler outro código" onCode={onCode} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    });
    expect(onCode).toHaveBeenCalledWith(EAN);
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ler outro código" })).toBeTruthy();
    expect(screen.queryByText("Aponte para o código de barras")).toBeNull();
  });

  it("onCode usa a prop mais nova", async () => {
    const fake = fakeScanner();
    fake.codes.push(EAN);
    const old = vi.fn();
    const fresh = vi.fn();
    const { rerender } = render(
      <ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={old} />,
    );
    rerender(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={fresh} />);
    await settle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(SCAN_INTERVAL_MS);
    });
    expect(old).not.toHaveBeenCalled();
    expect(fresh).toHaveBeenCalledWith(EAN);
  });

  it("sem autoStart nao abre a camera ate clicar no botao", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart={false} idleLabel="Ler código" onCode={vi.fn()} />);
    await settle();
    expect(fake.openCamera).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Ler código" }));
    await settle();
    expect(fake.openCamera).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Aponte para o código de barras")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Ler código" })).toBeNull();
  });

  it("desmontar durante a leitura para a track", async () => {
    const fake = fakeScanner();
    const { unmount } = render(
      <ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />,
    );
    await settle();
    expect(fake.streams[0]?.stop).not.toHaveBeenCalled();
    unmount();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
  });

  it("esconder para a track e voltar abre de novo", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    await settle();
    act(() => setVisibility("hidden"));
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ler código" })).toBeTruthy();
    act(() => setVisibility("visible"));
    await settle();
    expect(fake.openCamera).toHaveBeenCalledTimes(2);
    expect(screen.getByText("Aponte para o código de barras")).toBeTruthy();
  });

  it("esconder parado nao reabre ao voltar", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart={false} idleLabel="Ler código" onCode={vi.fn()} />);
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await settle();
    expect(fake.openCamera).not.toHaveBeenCalled();
  });

  it("pagehide para a track", async () => {
    const fake = fakeScanner();
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    await settle();
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
  });

  it("sem camera mostra o aviso sem Tentar de novo", async () => {
    render(<ScanView env={noCameraEnv()} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    await settle();
    expect(screen.getByRole("alert").textContent).toBe(
      "Este navegador não abre a câmera. Digite o código no campo abaixo.",
    );
    expect(screen.queryByRole("button", { name: "Tentar de novo" })).toBeNull();
  });

  it("permissao negada mostra o aviso e Tentar de novo abre outra vez", async () => {
    const fake = fakeScanner({
      openCamera: async () => Promise.reject(new DOMException("nao", "NotAllowedError")),
    });
    render(<ScanView env={fake.env} autoStart idleLabel="Ler código" onCode={vi.fn()} />);
    await settle();
    expect(screen.getByRole("alert").textContent).toBe(
      "Sem permissão para usar a câmera. Libere nas configurações do navegador ou digite o código no campo abaixo.",
    );
    const retry = screen.getByRole("button", { name: "Tentar de novo" });
    retry.focus();
    fireEvent.click(retry);
    await settle();
    expect(fake.openCamera).toHaveBeenCalledTimes(2);
    // O botao sumiu e voltou (erro de novo): o foco ficou no visor, nao no body.
    expect(document.activeElement).toBe(
      screen.getByRole("group", { name: "Leitor de código de barras" }),
    );
  });
});
