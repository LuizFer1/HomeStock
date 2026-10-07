export interface FloatSpec {
  amplitude: number;
  period: number;
  phase: number;
}

/** "amplitude,periodoS,fase" do data-float. Null se faltar parte ou o periodo nao for positivo. */
export function parseFloatSpec(raw: string | undefined): FloatSpec | null {
  if (!raw) return null;
  const [amplitude, period, phase] = raw.split(",").map(Number);
  if (amplitude === undefined || period === undefined || phase === undefined) return null;
  if (![amplitude, period, phase].every(Number.isFinite) || period <= 0) return null;
  return { amplitude, period, phase };
}

/** Deslocamento vertical (px) da flutuacao senoidal no instante t (s). */
export function floatOffset(t: number, spec: FloatSpec): number {
  return Math.sin((t * 2 * Math.PI) / spec.period + spec.phase) * spec.amplitude;
}

export interface FrameClock {
  request(cb: (now: number) => void): number;
  cancel(id: number): void;
}

/**
 * Flutuacao continua de todo [data-float]. Escreve so a variavel --float-y; o
 * CSS faz o translate. Parada com a aba escondida: ninguem ve, ninguem paga
 * bateria. Devolve a funcao que desliga.
 */
export function startFloat(doc: Document, clock: FrameClock): () => void {
  const items: Array<{ el: HTMLElement; spec: FloatSpec }> = [];
  for (const el of doc.querySelectorAll<HTMLElement>("[data-float]")) {
    const spec = parseFloatSpec(el.dataset.float);
    if (spec) items.push({ el, spec });
  }

  let id = 0;
  let t0 = -1;
  const frame = (now: number) => {
    if (t0 < 0) t0 = now;
    const t = (now - t0) / 1000;
    for (const { el, spec } of items) {
      el.style.setProperty("--float-y", `${floatOffset(t, spec).toFixed(2)}px`);
    }
    id = clock.request(frame);
  };

  const sync = () => {
    const hidden = doc.visibilityState === "hidden";
    if (hidden && id !== 0) {
      clock.cancel(id);
      id = 0;
    } else if (!hidden && id === 0) {
      id = clock.request(frame);
    }
  };

  doc.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    doc.removeEventListener("visibilitychange", sync);
    if (id !== 0) clock.cancel(id);
    id = 0;
  };
}

/**
 * Revela cada [data-reveal] quando 12% dele entra na tela, uma vez so. O atraso
 * vai em --reveal-delay. Marca data-motion-ready no <html> para o script do
 * <head> saber que o JS chegou (sem isso ele desliga a classe motion em 4 s).
 */
export function startReveal(doc: Document, IO: typeof IntersectionObserver): () => void {
  const io = new IO(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    },
    { threshold: 0.12 },
  );
  for (const el of doc.querySelectorAll<HTMLElement>("[data-reveal]")) {
    el.style.setProperty("--reveal-delay", `${Number(el.dataset.reveal) || 0}ms`);
    io.observe(el);
  }
  doc.documentElement.dataset.motionReady = "";
  return () => io.disconnect();
}
