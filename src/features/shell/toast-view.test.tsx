import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createToastStore } from "./toast";
import { ToastView } from "./toast-view";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ToastView", () => {
  it("sem toast nao mostra a pilula, mas a regiao viva fica montada", () => {
    const store = createToastStore();
    render(<ToastView store={store} raised={false} />);
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("mostra o texto em role=status", () => {
    const store = createToastStore();
    render(<ToastView store={store} raised={false} />);
    act(() => store.show("Café removido"));
    expect(screen.getByRole("status").textContent).toContain("Café removido");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Desfazer roda uma vez com dois cliques seguidos e fecha", async () => {
    const store = createToastStore();
    const run = vi.fn(async () => {});
    render(<ToastView store={store} raised={false} />);
    act(() => store.show("Café removido", { label: "Desfazer", run }));
    const button = screen.getByRole("button", { name: "Desfazer" });
    fireEvent.click(button);
    fireEvent.click(button);
    await vi.waitFor(() => expect(store.current.value).toBeNull());
    expect(run).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("Café removido")).toBeNull();
  });

  it("acao que falha mostra o aviso sem acao", async () => {
    const store = createToastStore();
    render(<ToastView store={store} raised={false} />);
    act(() =>
      store.show("Café removido", {
        label: "Desfazer",
        run: async () => {
          throw new Error("x");
        },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    expect(await screen.findByText("Não foi possível desfazer.")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Desfazer" })).toBeNull();
  });

  it("novo toast com acao depois de um usado aceita o clique de novo", async () => {
    const store = createToastStore();
    const run = vi.fn(async () => {});
    render(<ToastView store={store} raised={false} />);
    act(() => store.show("Um", { label: "Desfazer", run }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await vi.waitFor(() => expect(store.current.value).toBeNull());
    act(() => store.show("Dois", { label: "Desfazer", run }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await vi.waitFor(() => expect(run).toHaveBeenCalledTimes(2));
  });

  it("acao que termina depois de um toast novo nao fecha o novo", async () => {
    const store = createToastStore();
    let release: () => void = () => {};
    const run = () =>
      new Promise<void>((resolve) => {
        release = resolve;
      });
    render(<ToastView store={store} raised={false} />);
    act(() => store.show("Um", { label: "Desfazer", run }));
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    act(() => store.show("Dois"));
    await act(async () => {
      release();
      await Promise.resolve();
    });
    expect(store.current.value?.text).toBe("Dois");
  });

  it("raised troca a classe de bottom", () => {
    const store = createToastStore();
    const { rerender } = render(<ToastView store={store} raised={false} />);
    act(() => store.show("Oi"));
    const pill = () => screen.getByText("Oi").parentElement as HTMLElement;
    expect(pill().className).toContain("bottom-[100px]");
    rerender(<ToastView store={store} raised />);
    expect(pill().className).toContain("bottom-[164px]");
    expect(pill().className).not.toContain("bottom-[100px]");
  });

  it("some sozinho aos 4 s", () => {
    vi.useFakeTimers();
    const store = createToastStore();
    render(<ToastView store={store} raised={false} />);
    act(() => store.show("Oi"));
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(screen.queryByText("Oi")).toBeNull();
  });
});
