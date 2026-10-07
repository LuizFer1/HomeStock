import { afterEach, describe, expect, it } from "vitest";
import { floatOffset, parseFloatSpec, startFloat, startReveal } from "./motion";

afterEach(() => {
  document.body.innerHTML = "";
  Reflect.deleteProperty(document, "visibilityState");
  document.documentElement.removeAttribute("data-motion-ready");
});

describe("parseFloatSpec", () => {
  it("le amplitude, periodo e fase", () => {
    expect(parseFloatSpec("14,9,0")).toEqual({ amplitude: 14, period: 9, phase: 0 });
    expect(parseFloatSpec("3,1.8,2.8")).toEqual({ amplitude: 3, period: 1.8, phase: 2.8 });
  });

  it("recusa o que nao da para animar", () => {
    for (const raw of [undefined, "", "1,2", "a,b,c", "5,0,1", "5,-1,0"]) {
      expect(parseFloatSpec(raw), String(raw)).toBeNull();
    }
  });
});

describe("floatOffset", () => {
  it("seno de amplitude e periodo dados", () => {
    const spec = { amplitude: 10, period: 4, phase: 0 };
    expect(floatOffset(0, spec)).toBeCloseTo(0);
    expect(floatOffset(1, spec)).toBeCloseTo(10);
    expect(floatOffset(3, spec)).toBeCloseTo(-10);
  });
});

function fakeClock() {
  const pending = new Map<number, (now: number) => void>();
  let next = 1;
  return {
    pending,
    request(cb: (now: number) => void): number {
      const id = next++;
      pending.set(id, cb);
      return id;
    },
    cancel(id: number): void {
      pending.delete(id);
    },
    tick(now: number): void {
      const cbs = [...pending.values()];
      pending.clear();
      for (const cb of cbs) cb(now);
    },
  };
}

describe("startFloat", () => {
  it("escreve --float-y em cada [data-float] valido", () => {
    document.body.innerHTML = '<span data-float="10,4,0"></span><span data-float="nada"></span>';
    const clock = fakeClock();
    const stop = startFloat(document, clock);
    clock.tick(0);
    clock.tick(1000);
    const [ok, bad] = [...document.querySelectorAll<HTMLElement>("span")];
    expect(ok?.style.getPropertyValue("--float-y")).toBe("10.00px");
    expect(bad?.style.getPropertyValue("--float-y")).toBe("");
    stop();
    expect(clock.pending.size).toBe(0);
  });

  it("para com a aba escondida e volta quando ela aparece", () => {
    document.body.innerHTML = '<span data-float="10,4,0"></span>';
    let state: DocumentVisibilityState = "visible";
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => state });
    const clock = fakeClock();
    const stop = startFloat(document, clock);
    expect(clock.pending.size).toBe(1);
    state = "hidden";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(clock.pending.size).toBe(0);
    state = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    expect(clock.pending.size).toBe(1);
    stop();
  });
});

class FakeIO {
  static last: FakeIO | undefined;
  readonly observed = new Set<Element>();
  readonly callback: IntersectionObserverCallback;
  readonly options: IntersectionObserverInit | undefined;

  constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) {
    this.callback = callback;
    this.options = options;
    FakeIO.last = this;
  }

  observe(el: Element): void {
    this.observed.add(el);
  }

  unobserve(el: Element): void {
    this.observed.delete(el);
  }

  disconnect(): void {
    this.observed.clear();
  }

  enter(el: Element): void {
    const entry = { isIntersecting: true, target: el } as unknown as IntersectionObserverEntry;
    this.callback([entry], this as unknown as IntersectionObserver);
  }
}

describe("startReveal", () => {
  it("observa com 12%, guarda o atraso e revela uma vez", () => {
    document.body.innerHTML = '<p data-reveal="120">a</p><p data-reveal="0">b</p>';
    startReveal(document, FakeIO as unknown as typeof IntersectionObserver);
    const io = FakeIO.last;
    const [a, b] = [...document.querySelectorAll<HTMLElement>("p")];
    if (!io || !a || !b) throw new Error("fixture incompleta");

    expect(io.options?.threshold).toBe(0.12);
    expect(a.style.getPropertyValue("--reveal-delay")).toBe("120ms");
    expect(b.style.getPropertyValue("--reveal-delay")).toBe("0ms");
    expect(io.observed.size).toBe(2);

    io.enter(a);
    expect(a.classList.contains("is-visible")).toBe(true);
    expect(io.observed.has(a)).toBe(false);
    expect(b.classList.contains("is-visible")).toBe(false);
    expect("motionReady" in document.documentElement.dataset).toBe(true);
  });
});
