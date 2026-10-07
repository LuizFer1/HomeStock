import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createToastStore, TOAST_MS } from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createToastStore", () => {
  it("show publica o texto e a acao", () => {
    const store = createToastStore();
    const action = { label: "Desfazer", run: async () => {} };
    store.show("Café removido", action);
    expect(store.current.value?.text).toBe("Café removido");
    expect(store.current.value?.action).toBe(action);
  });

  it("sem acao publica action null", () => {
    const store = createToastStore();
    store.show("Oi");
    expect(store.current.value?.action).toBeNull();
  });

  it("some em 4000 ms e nao antes", () => {
    const store = createToastStore();
    store.show("Oi");
    vi.advanceTimersByTime(TOAST_MS - 1);
    expect(store.current.value).not.toBeNull();
    vi.advanceTimersByTime(1);
    expect(store.current.value).toBeNull();
  });

  it("segundo show substitui e reinicia os 4 s", () => {
    const store = createToastStore();
    store.show("Um");
    const first = store.current.value?.id;
    vi.advanceTimersByTime(3000);
    store.show("Dois");
    expect(store.current.value?.text).toBe("Dois");
    expect(store.current.value?.id).not.toBe(first);
    vi.advanceTimersByTime(3000);
    expect(store.current.value?.text).toBe("Dois");
    vi.advanceTimersByTime(1000);
    expect(store.current.value).toBeNull();
  });

  it("dismiss com id velho nao fecha o novo", () => {
    const store = createToastStore();
    store.show("Um");
    const old = store.current.value?.id ?? -1;
    store.show("Dois");
    store.dismiss(old);
    expect(store.current.value?.text).toBe("Dois");
  });

  it("dismiss sem id fecha o atual e cancela o timer", () => {
    const store = createToastStore();
    store.show("Um");
    store.dismiss();
    expect(store.current.value).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("dismiss com o id atual fecha", () => {
    const store = createToastStore();
    store.show("Um");
    store.dismiss(store.current.value?.id);
    expect(store.current.value).toBeNull();
  });
});
