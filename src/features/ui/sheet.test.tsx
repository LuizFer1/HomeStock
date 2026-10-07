import { act, cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Sheet } from "./sheet";

afterEach(cleanup);

function dialog(): HTMLDialogElement {
  return document.querySelector("dialog") as HTMLDialogElement;
}

/** Pai real: fecha o estado no onClose, como o Estoque fara. */
function Harness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button type="button" onClick={() => setOpen(false)}>
        Fechar de fora
      </button>
      <Sheet
        open={open}
        label="Ações"
        onClose={() => {
          onClose();
          setOpen(false);
        }}
      >
        <p>Oi</p>
      </Sheet>
    </>
  );
}

describe("Sheet", () => {
  it("backdrop chama onClose exatamente uma vez e fecha", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(dialog());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog().open).toBe(false);
  });

  it("Esc chama onClose exatamente uma vez", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    // E o que o navegador faz no Esc: fecha o dialog e dispara `close`.
    act(() => dialog().close());
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(dialog().open).toBe(false);
  });

  it("fechar pela prop nao chama onClose", () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />);
    fireEvent.click(screen.getByText("Fechar de fora"));
    expect(dialog().open).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("o painel rola quando o conteudo passa da tela", () => {
    render(
      <Sheet open label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    const panel = screen.getByText("Oi").parentElement as HTMLElement;
    expect(panel.className).toContain("max-h-[85dvh]");
    expect(panel.className).toContain("overflow-y-auto");
  });

  // O happy-dom implementa `showModal`/`close` (so o atributo `open` e o evento
  // `close`), entao nao ha polyfill aqui.
  it("open abre o dialog com o nome acessivel", () => {
    render(
      <Sheet open label="Ações de Café" onClose={() => {}}>
        <button type="button">Editar</button>
      </Sheet>,
    );
    expect(dialog().open).toBe(true);
    expect(dialog().getAttribute("aria-label")).toBe("Ações de Café");
    expect(screen.getByRole("button", { name: "Editar" })).toBeTruthy();
  });

  it("open=false fecha", () => {
    const { rerender } = render(
      <Sheet open label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    rerender(
      <Sheet open={false} label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    expect(dialog().open).toBe(false);
  });

  it("evento close (Esc) chama onClose", () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="Ações" onClose={onClose}>
        <p>Oi</p>
      </Sheet>,
    );
    fireEvent(dialog(), new Event("close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("clique no proprio dialog (backdrop) fecha, clique num filho nao", () => {
    const onClose = vi.fn();
    render(
      <Sheet open label="Ações" onClose={onClose}>
        <p>Oi</p>
      </Sheet>,
    );
    fireEvent.click(screen.getByText("Oi"));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(dialog());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("o handle e decorativo", () => {
    render(
      <Sheet open label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    const handle = dialog().querySelector("[aria-hidden='true']");
    expect(handle?.className).toContain("w-11");
  });

  it("fechar devolve o foco a quem abriu", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    const { rerender } = render(
      <Sheet open label="Ações" onClose={() => {}}>
        <button type="button">Editar</button>
      </Sheet>,
    );
    screen.getByRole("button", { name: "Editar" }).focus();
    rerender(
      <Sheet open={false} label="Ações" onClose={() => {}}>
        <button type="button">Editar</button>
      </Sheet>,
    );
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("Esc tambem devolve o foco a quem abriu", () => {
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();
    render(
      <Sheet open label="Ações" onClose={() => {}}>
        <button type="button">Editar</button>
      </Sheet>,
    );
    screen.getByRole("button", { name: "Editar" }).focus();
    fireEvent(dialog(), new Event("close"));
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("foco que quem fechou ja moveu fica onde esta", () => {
    const opener = document.createElement("button");
    const search = document.createElement("input");
    document.body.append(opener, search);
    opener.focus();
    const { rerender } = render(
      <Sheet open label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    search.focus();
    rerender(
      <Sheet open={false} label="Ações" onClose={() => {}}>
        <p>Oi</p>
      </Sheet>,
    );
    expect(document.activeElement).toBe(search);
    opener.remove();
    search.remove();
  });
});
