import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScanView } from "./scan-view";
import { SCAN_INTERVAL_MS } from "./scanner";
import { fakeScanner, noCameraEnv } from "./scanner.fake";

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
    await settle();
    expect(screen.getByText("Aponte para o código de barras")).toBeTruthy();
    expect(fake.openCamera).toHaveBeenCalledTimes(1);
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
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await settle();
    expect(fake.openCamera).toHaveBeenCalledTimes(2);
  });
});
