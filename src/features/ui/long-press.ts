import { useEffect, useRef, useState } from "preact/hooks";

export const LONG_PRESS_MS = 450;
/** Dedo que andou mais que isto esta rolando a lista, nao segurando. */
export const MOVE_TOLERANCE_PX = 10;
export const HAPTIC_MS = 12;

export interface LongPress {
  pressing: boolean;
  handlers: {
    onPointerDown: (e: PointerEvent) => void;
    onPointerMove: (e: PointerEvent) => void;
    onPointerUp: () => void;
    onPointerLeave: () => void;
    onPointerCancel: () => void;
    onContextMenu: (e: Event) => void;
  };
  /**
   * true uma vez depois de um long-press: o click que segue deve ser ignorado.
   * Click do teclado (`detail` 0) nunca e engolido.
   */
  consumeClick: (e: MouseEvent) => boolean;
}

/**
 * Segurar 450 ms (handoff, "Interactions & Behavior"). O clique direito e a
 * tecla de menu chegam como `contextmenu` e abrem na hora.
 *
 * Quem usa precisa por `select-none` e `[-webkit-touch-callout:none]` no alvo:
 * sem isso o navegador seleciona o texto ou abre o menu do link no meio da
 * pressao, e o gesto briga com o do sistema.
 */
export function useLongPress(onLongPress: () => void): LongPress {
  const [pressing, setPressing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const origin = useRef<{ x: number; y: number } | null>(null);
  const fired = useRef(false);
  // A callback mais nova, sem reiniciar uma pressao em curso a cada render.
  const callback = useRef(onLongPress);
  callback.current = onLongPress;

  function clearTimer() {
    if (timer.current !== null) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  }

  function clearSettle() {
    if (settle.current !== null) {
      clearTimeout(settle.current);
      settle.current = null;
    }
  }

  function cancel() {
    clearTimer();
    origin.current = null;
    setPressing(false);
  }

  // O click do soltar chega no mesmo ciclo do pointerup. Se nao chegou ate o
  // proximo ciclo (o sheet abriu por cima e o click caiu nele), a marca morre
  // aqui, senao engoliria o proximo toque ou Enter no card.
  function release() {
    cancel();
    if (!fired.current) return;
    clearSettle();
    settle.current = setTimeout(() => {
      settle.current = null;
      fired.current = false;
    }, 0);
  }

  // Desmontar no meio da pressao (lista que mudou) nao pode disparar depois.
  useEffect(
    () => () => {
      clearTimer();
      clearSettle();
    },
    [],
  );

  return {
    pressing,
    handlers: {
      onPointerDown(e) {
        // Segundo dedo e pinca ou gesto do sistema, nao segurar o card.
        if (!e.isPrimary) {
          cancel();
          return;
        }
        if (e.button !== 0) return;
        // Pressao nova: um disparo antigo sem click depois nao pode engolir este toque.
        clearSettle();
        fired.current = false;
        // Toque captura o ponteiro no alvo e, com captura, o `pointerleave`
        // nunca dispara. Encadeamento opcional porque o happy-dom nao tem a API.
        const target = e.currentTarget as Element | null;
        if (target?.hasPointerCapture?.(e.pointerId)) target.releasePointerCapture(e.pointerId);
        clearTimer();
        origin.current = { x: e.clientX, y: e.clientY };
        setPressing(true);
        timer.current = setTimeout(() => {
          timer.current = null;
          origin.current = null;
          setPressing(false);
          fired.current = true;
          // Navegador que bloqueia a vibracao (iframe, politica) pode lancar.
          try {
            navigator.vibrate?.(HAPTIC_MS);
          } catch {}
          callback.current();
        }, LONG_PRESS_MS);
      },
      onPointerMove(e) {
        const start = origin.current;
        if (start === null) return;
        if (Math.hypot(e.clientX - start.x, e.clientY - start.y) > MOVE_TOLERANCE_PX) cancel();
      },
      onPointerUp: release,
      onPointerLeave: release,
      onPointerCancel: release,
      onContextMenu(e) {
        e.preventDefault();
        // O Android manda `contextmenu` depois do nosso timer: ja abrimos.
        if (fired.current) return;
        // So marca o click a engolir se havia um dedo segurando (toque longo do
        // sistema antes dos 450 ms). Clique direito e tecla de menu nao tem
        // pointerdown nosso, e marcar ali engoliria o proximo Enter.
        if (timer.current !== null) fired.current = true;
        cancel();
        callback.current();
      },
    },
    consumeClick(e) {
      const was = fired.current;
      fired.current = false;
      clearSettle();
      // Enter ou Espaco no card nunca vem de um long-press.
      return was && e.detail !== 0;
    },
  };
}
