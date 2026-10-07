import { beforeEach, describe, expect, it } from "vitest";
import { bindDialog } from "./dialog";

function mount() {
  document.body.innerHTML = `
    <button type="button" id="opener">Abrir</button>
    <dialog id="d">
      <div class="dialog">
        <button type="button" id="x" data-dialog-close>Fechar</button>
        <p id="texto">Texto</p>
      </div>
    </dialog>`;
  const dialog = document.getElementById("d") as HTMLDialogElement;
  const opener = document.getElementById("opener") as HTMLElement;
  return { dialog, opener, handle: bindDialog(dialog) };
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("bindDialog", () => {
  it("abrir deixa o dialog aberto", () => {
    const { dialog, handle, opener } = mount();
    handle.open(opener);
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("[data-dialog-close] fecha e devolve o foco ao opener", () => {
    const { dialog, handle, opener } = mount();
    handle.open(opener);
    document.getElementById("x")?.click();
    expect(dialog.hasAttribute("open")).toBe(false);
    expect(document.activeElement).toBe(opener);
  });

  it("clique no proprio dialog (fundo) fecha", () => {
    const { dialog, handle, opener } = mount();
    handle.open(opener);
    dialog.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(dialog.hasAttribute("open")).toBe(false);
  });

  it("clique dentro do cartao nao fecha", () => {
    const { dialog, handle, opener } = mount();
    handle.open(opener);
    document.getElementById("texto")?.click();
    expect(dialog.hasAttribute("open")).toBe(true);
  });

  it("o evento close (Esc) devolve o foco", () => {
    const { dialog, handle, opener } = mount();
    handle.open(opener);
    dialog.removeAttribute("open");
    dialog.dispatchEvent(new Event("close"));
    expect(document.activeElement).toBe(opener);
  });

  it("sem showModal cai em open e foca o primeiro controle", () => {
    const { dialog, handle, opener } = mount();
    (dialog as unknown as { showModal?: unknown }).showModal = undefined;
    handle.open(opener);
    expect(dialog.hasAttribute("open")).toBe(true);
    expect(document.activeElement?.id).toBe("x");
  });
});
