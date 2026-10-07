import { ScannerUnavailableError } from "./reader";

/** Sem `navigator.mediaDevices` (contexto inseguro, navegador antigo). */
export class CameraUnsupportedError extends Error {
  constructor() {
    super("navigator.mediaDevices indisponivel");
    this.name = "CameraUnsupportedError";
  }
}

export const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
};

/** `media` undefined -> a funcao rejeita com CameraUnsupportedError. */
export function openCameraWith(
  media: Pick<MediaDevices, "getUserMedia"> | undefined,
): () => Promise<MediaStream> {
  return async () => {
    if (media === undefined) throw new CameraUnsupportedError();
    return media.getUserMedia(CAMERA_CONSTRAINTS);
  };
}

/** Para todas as tracks: e o que apaga a luz da camera. */
export function stopStream(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

const TYPE_IT = "Digite o código no campo abaixo.";

/** Mensagem pt-BR para o visor e se "Tentar de novo" faz sentido. */
export function cameraErrorMessage(cause: unknown): { message: string; retry: boolean } {
  if (cause instanceof CameraUnsupportedError) {
    return { message: `Este navegador não abre a câmera. ${TYPE_IT}`, retry: false };
  }
  if (cause instanceof ScannerUnavailableError) {
    return cause.offline
      ? {
          message:
            "O leitor de código ainda não foi baixado. Conecte-se à internet uma vez ou digite o código no campo abaixo.",
          retry: true,
        }
      : {
          // Tentar de novo baixaria o mesmo arquivo que ja nao existe no servidor.
          message:
            "O app foi atualizado e o leitor é da versão anterior. Feche e abra o app, ou digite o código no campo abaixo.",
          retry: false,
        };
  }
  // DOMException real e objetos falsos dos testes: so o `name` importa.
  const name =
    typeof cause === "object" && cause !== null && "name" in cause ? String(cause.name) : "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return {
        message:
          "Sem permissão para usar a câmera. Libere nas configurações do navegador ou digite o código no campo abaixo.",
        retry: true,
      };
    case "NotFoundError":
    case "OverconstrainedError":
      return { message: `Nenhuma câmera encontrada neste aparelho. ${TYPE_IT}`, retry: false };
    case "NotReadableError":
    case "AbortError":
      return {
        message: "A câmera está ocupada por outro app. Feche-o e tente de novo.",
        retry: true,
      };
    default:
      return { message: `Não foi possível abrir a câmera. ${TYPE_IT}`, retry: true };
  }
}
