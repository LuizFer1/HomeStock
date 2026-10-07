import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HAPTIC_MS, LONG_PRESS_MS, type LongPress, useLongPress } from "./long-press";

let last: LongPress | null = null;

function Probe({ onLongPress }: { onLongPress: () => void }) {
  const press = useLongPress(onLongPress);
  last = press;
  return (
    <button type="button" data-pressing={press.pressing ? "true" : undefined} {...press.handlers}>
      Café
    </button>
  );
}

function setup() {
  const onLongPress = vi.fn();
  const result = render(<Probe onLongPress={onLongPress} />);
  const button = screen.getByRole("button", { name: "Café" });
  return { onLongPress, button, ...result };
}

function down(el: HTMLElement, init: Partial<PointerEventInit> = {}) {
  fireEvent.pointerDown(el, { button: 0, isPrimary: true, clientX: 0, clientY: 0, ...init });
}

/** Click de ponteiro: `detail` conta os cliques. */
function pointerClick(): MouseEvent {
  return new MouseEvent("click", { detail: 1 });
}

/** Click do teclado (Enter, Espaco): `detail` 0. */
function keyClick(): MouseEvent {
  return new MouseEvent("click", { detail: 0 });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  last = null;
});

describe("useLongPress", () => {
  it("dispara aos 450 ms e nao aos 449", () => {
    const { onLongPress, button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS - 1);
    });
    expect(onLongPress).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("pressing fica true durante e volta a false ao disparar", () => {
    const { button } = setup();
    down(button);
    expect(button.dataset.pressing).toBe("true");
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(button.dataset.pressing).toBeUndefined();
  });

  it("pointerUp antes cancela", () => {
    const { onLongPress, button } = setup();
    down(button);
    fireEvent.pointerUp(button);
    expect(button.dataset.pressing).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("pointerLeave e pointerCancel cancelam", () => {
    const { onLongPress, button } = setup();
    down(button);
    fireEvent.pointerLeave(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    down(button);
    fireEvent.pointerCancel(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("mover 11 px cancela, 5 px nao", () => {
    const { onLongPress, button } = setup();
    down(button);
    fireEvent.pointerMove(button, { clientX: 3, clientY: 4 });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);

    down(button);
    fireEvent.pointerMove(button, { clientX: 0, clientY: 11 });
    expect(button.dataset.pressing).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("botao direito no pointerdown nao inicia", () => {
    const { onLongPress, button } = setup();
    down(button, { button: 2 });
    expect(button.dataset.pressing).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("contextMenu dispara na hora, com preventDefault", () => {
    const { onLongPress, button } = setup();
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
    fireEvent(button, event);
    expect(event.defaultPrevented).toBe(true);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("contextMenu depois do timer nao dispara de novo", () => {
    const { onLongPress, button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    fireEvent.contextMenu(button);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("contextMenu durante a pressao cancela o timer e dispara uma vez", () => {
    const { onLongPress, button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(200);
    });
    fireEvent.contextMenu(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(last?.consumeClick(pointerClick())).toBe(true);
  });

  it("consumeClick e true uma vez depois do disparo", () => {
    const { button } = setup();
    expect(last?.consumeClick(pointerClick())).toBe(false);
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(last?.consumeClick(pointerClick())).toBe(true);
    expect(last?.consumeClick(pointerClick())).toBe(false);
  });

  it("clique direito ou tecla de menu nao engolem o proximo clique", () => {
    const { button } = setup();
    fireEvent.contextMenu(button);
    // O clique seguinte (Enter do teclado) nao vem precedido de pointerdown.
    expect(last?.consumeClick(pointerClick())).toBe(false);
  });

  it("click do teclado nunca e engolido", () => {
    const { button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(last?.consumeClick(keyClick())).toBe(false);
  });

  it("disparo sem click depois (sheet por cima) nao engole o proximo Enter", () => {
    const { button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    // O sheet abriu por cima: o dedo sai do card e o click nunca chega nele.
    fireEvent.pointerLeave(button);
    fireEvent.pointerUp(button);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(last?.consumeClick(pointerClick())).toBe(false);
  });

  it("o click que segue o soltar ainda e engolido", () => {
    const { button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    fireEvent.pointerUp(button);
    // Mesmo ciclo do pointerup, antes do setTimeout 0.
    expect(last?.consumeClick(pointerClick())).toBe(true);
  });

  it("segundo dedo durante a pressao cancela", () => {
    const { onLongPress, button } = setup();
    down(button);
    down(button, { isPrimary: false, pointerId: 2 });
    expect(button.dataset.pressing).toBeUndefined();
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("ponteiro nao primario sozinho nao inicia", () => {
    const { onLongPress, button } = setup();
    down(button, { isPrimary: false });
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it("desmontar logo depois de soltar limpa o timer de limpeza", () => {
    const { button, unmount } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    fireEvent.pointerUp(button);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("vibra 12 ms ao disparar", () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const { button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(vibrate).toHaveBeenCalledWith(HAPTIC_MS);
    expect(HAPTIC_MS).toBe(12);
  });

  it("vibrate que lanca nao impede o disparo", () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      vibrate: () => {
        throw new Error("bloqueado");
      },
    });
    const { onLongPress, button } = setup();
    down(button);
    act(() => {
      vi.advanceTimersByTime(LONG_PRESS_MS);
    });
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it("desmontar limpa o timer", () => {
    const { onLongPress, button, unmount } = setup();
    down(button);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(LONG_PRESS_MS);
    expect(onLongPress).not.toHaveBeenCalled();
  });
});
