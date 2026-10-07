import { describe, expect, it, vi } from "vitest";
import {
  CAMERA_CONSTRAINTS,
  CameraUnsupportedError,
  cameraErrorMessage,
  openCameraWith,
  stopStream,
} from "./camera";
import { ScannerUnavailableError } from "./reader";

describe("cameraErrorMessage", () => {
  it("sem mediaDevices: nao abre camera, sem tentar de novo", () => {
    expect(cameraErrorMessage(new CameraUnsupportedError())).toEqual({
      message: "Este navegador não abre a câmera. Digite o código no campo abaixo.",
      retry: false,
    });
  });

  it.each(["NotAllowedError", "SecurityError"])("%s: sem permissao, tenta de novo", (name) => {
    expect(cameraErrorMessage(new DOMException("x", name))).toEqual({
      message:
        "Sem permissão para usar a câmera. Libere nas configurações do navegador ou digite o código no campo abaixo.",
      retry: true,
    });
  });

  it.each(["NotFoundError", "OverconstrainedError"])(
    "%s: sem camera, sem tentar de novo",
    (name) => {
      expect(cameraErrorMessage(new DOMException("x", name))).toEqual({
        message: "Nenhuma câmera encontrada neste aparelho. Digite o código no campo abaixo.",
        retry: false,
      });
    },
  );

  it("NotReadableError (objeto falso) e AbortError: camera ocupada", () => {
    const busy = {
      message: "A câmera está ocupada por outro app. Feche-o e tente de novo.",
      retry: true,
    };
    expect(cameraErrorMessage({ name: "NotReadableError" })).toEqual(busy);
    expect(cameraErrorMessage(new DOMException("x", "AbortError"))).toEqual(busy);
  });

  it("leitor indisponivel offline: ainda nao baixado, tenta de novo", () => {
    expect(cameraErrorMessage(new ScannerUnavailableError(true, new Error("x")))).toEqual({
      message:
        "O leitor de código ainda não foi baixado. Conecte-se à internet uma vez ou digite o código no campo abaixo.",
      retry: true,
    });
  });

  it("leitor indisponivel online: versao velha, sem tentar de novo", () => {
    expect(cameraErrorMessage(new ScannerUnavailableError(false, new Error("x")))).toEqual({
      message:
        "O app foi atualizado e o leitor é da versão anterior. Feche e abra o app, ou digite o código no campo abaixo.",
      retry: false,
    });
  });

  it.each([new Error("x"), "texto", null, undefined, { name: "OutroError" }])(
    "qualquer outra causa (%s): mensagem generica, tenta de novo",
    (cause) => {
      expect(cameraErrorMessage(cause)).toEqual({
        message: "Não foi possível abrir a câmera. Digite o código no campo abaixo.",
        retry: true,
      });
    },
  );
});

describe("openCameraWith", () => {
  it("sem mediaDevices rejeita CameraUnsupportedError", async () => {
    const error = await openCameraWith(undefined)().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CameraUnsupportedError);
    expect((error as Error).name).toBe("CameraUnsupportedError");
  });

  it("pede a camera com as restricoes do leitor", async () => {
    const stream = {} as MediaStream;
    const getUserMedia = vi.fn(async () => stream);
    await expect(openCameraWith({ getUserMedia })()).resolves.toBe(stream);
    expect(getUserMedia).toHaveBeenCalledWith(CAMERA_CONSTRAINTS);
  });
});

describe("stopStream", () => {
  it("para todas as tracks", () => {
    const a = { stop: vi.fn() };
    const b = { stop: vi.fn() };
    stopStream({ getTracks: () => [a, b] } as unknown as MediaStream);
    expect(a.stop).toHaveBeenCalledOnce();
    expect(b.stop).toHaveBeenCalledOnce();
  });
});
