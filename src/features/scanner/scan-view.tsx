import { ScanBarcode } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { BTN_BASE } from "../ui/button";
import type { ScannerEnv } from "./env";
import { createScanner } from "./scanner";

export interface ScanViewProps {
  env: ScannerEnv;
  /** Abre a camera ao montar (FAB Escanear). */
  autoStart: boolean;
  /** "Ler código" antes da primeira leitura, "Ler outro código" depois. */
  idleLabel: string;
  onCode: (ean: string) => void;
}

const SCAN_BUTTON = `${BTN_BASE} px-5 bg-bg text-text`;
const CORNER = "absolute size-7 border-accent-400";

/** Visor da camera do markup 2d (linhas 343 a 352). */
export function ScanView({ env, autoStart, idleLabel, onCode }: ScanViewProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  // A pagina recria onCode a cada render; o scanner, criado uma vez, le sempre o mais novo.
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;
  const [scanner] = useState(() =>
    createScanner({
      env,
      video: () => videoRef.current,
      onCode: (ean) => onCodeRef.current(ean),
    }),
  );
  const group = useRef<HTMLFieldSetElement>(null);

  // So no mount: autoStart descreve como a tela abriu; mudar depois nao reabre a camera.
  useEffect(() => {
    if (autoStart) void scanner.start();
    // Camera ligada fora da vista gasta bateria, mantem a luz verde acesa e prende o
    // hardware para outros apps: esconder a aba para tudo.
    let resume = false;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        const { phase } = scanner.state.value;
        resume = phase === "starting" || phase === "scanning";
        scanner.stop();
      } else if (resume) {
        // A pessoa so trocou de app um instante: volta a ler sem pedir outro toque.
        resume = false;
        void scanner.start();
      }
    };
    const onPageHide = () => scanner.stop();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      scanner.stop();
    };
  }, [scanner]);

  const state = scanner.state.value;
  const live = state.phase === "starting" || state.phase === "scanning";
  const start = () => {
    // O botao some ao abrir: o foco iria para o body; fica no proprio visor.
    group.current?.focus();
    void scanner.start();
  };
  // Em starting o video precisa de layout (display:none durante o play() atrapalha alguns
  // navegadores); so fica invisivel ate o primeiro quadro.
  const videoVisibility =
    state.phase === "scanning" ? "" : state.phase === "starting" ? " opacity-0" : " hidden";

  return (
    // fieldset da o papel group (como o CountStepper); as classes de reset tiram borda e recuo.
    <fieldset
      ref={group}
      tabIndex={-1}
      aria-label="Leitor de código de barras"
      class="relative mx-0 mt-3 mb-0 grid h-[170px] min-w-0 place-items-center overflow-hidden rounded-[32px] border-0 bg-neutral-900 p-0"
    >
      {/* Sempre montado: o ref existe antes da abertura e o attach tem onde tocar. */}
      {/* biome-ignore lint/a11y/noAriaHiddenOnFocusable: video sem controls nao recebe foco; e so imagem */}
      <video
        ref={videoRef}
        muted
        playsInline
        aria-hidden="true"
        class={`absolute inset-0 size-full object-cover${videoVisibility}`}
      />
      {live && (
        <div aria-hidden="true" class="relative z-[1] h-[96px] w-[210px]">
          <span class={`${CORNER} top-0 left-0 rounded-tl-[16px] border-t-4 border-l-4`} />
          <span class={`${CORNER} top-0 right-0 rounded-tr-[16px] border-t-4 border-r-4`} />
          <span class={`${CORNER} bottom-0 left-0 rounded-bl-[16px] border-b-4 border-l-4`} />
          <span class={`${CORNER} right-0 bottom-0 rounded-br-[16px] border-r-4 border-b-4`} />
          <span class="absolute inset-x-4 top-[calc(50%-2px)] h-1 rounded-pill bg-accent-400" />
        </div>
      )}
      {state.phase === "idle" && (
        <button type="button" class={SCAN_BUTTON} onClick={start}>
          <ScanBarcode size={18} strokeWidth={2.75} />
          {idleLabel}
        </button>
      )}
      {state.phase === "error" && (
        <div class="relative z-[1] flex flex-col items-center gap-3 px-6 text-center">
          <p role="alert" class="text-[13px] font-semibold text-neutral-100">
            {state.message}
          </p>
          {state.retry && (
            <button type="button" class={SCAN_BUTTON} onClick={start}>
              <ScanBarcode size={18} strokeWidth={2.75} />
              Tentar de novo
            </button>
          )}
        </div>
      )}
      {/* Regiao viva sempre montada: o leitor de tela so anuncia mudancas num no que ja existia. */}
      <span
        aria-live="polite"
        class="absolute bottom-3 z-[1] text-[12px] font-semibold text-neutral-300"
      >
        {state.phase === "scanning"
          ? "Aponte para o código de barras"
          : state.phase === "starting"
            ? "Abrindo a câmera…"
            : ""}
      </span>
    </fieldset>
  );
}
