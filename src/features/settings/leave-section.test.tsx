import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LeaveSection } from "./leave-section";

afterEach(cleanup);

function open(onLeave = vi.fn().mockResolvedValue(undefined)) {
  render(<LeaveSection onLeave={onLeave} />);
  fireEvent.click(screen.getByRole("button", { name: "Sair da casa" }));
  return onLeave;
}

function confirmButton() {
  return screen.getByRole("button", { name: "Apagar dados deste aparelho" }) as HTMLButtonElement;
}

function type(text: string) {
  fireEvent.input(screen.getByLabelText("Digite APAGAR para confirmar"), {
    target: { value: text },
  });
}

describe("LeaveSection", () => {
  it("Sair da casa abre o card com o aviso", () => {
    open();
    expect(screen.getByText(/Não há como desfazer/)).toBeTruthy();
    expect(confirmButton().disabled).toBe(true);
  });

  it("so habilita com APAGAR exato", () => {
    open();
    type("apagar");
    expect(confirmButton().disabled).toBe(true);
    type(" APAGAR");
    expect(confirmButton().disabled).toBe(true);
    type("APAGAR");
    expect(confirmButton().disabled).toBe(false);
  });

  it("APAGAR chama onLeave uma vez mesmo com duplo toque", async () => {
    const onLeave = open();
    type("APAGAR");
    fireEvent.click(confirmButton());
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(1));
  });

  it("rejeicao mostra o alerta e deixa tentar de novo", async () => {
    const onLeave = vi.fn().mockRejectedValueOnce(new Error("banco bloqueado"));
    open(onLeave);
    type("APAGAR");
    fireEvent.click(confirmButton());
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Não foi possível apagar os dados: banco bloqueado",
    );
    await waitFor(() => expect(confirmButton().disabled).toBe(false));
    onLeave.mockResolvedValue(undefined);
    fireEvent.click(confirmButton());
    await waitFor(() => expect(onLeave).toHaveBeenCalledTimes(2));
  });

  it("Cancelar fecha, limpa o campo e devolve o foco", () => {
    open();
    type("APAGAR");
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(screen.queryByLabelText("Digite APAGAR para confirmar")).toBeNull();
    const trigger = screen.getByRole("button", { name: "Sair da casa" });
    expect(document.activeElement).toBe(trigger);
    fireEvent.click(trigger);
    expect((screen.getByLabelText("Digite APAGAR para confirmar") as HTMLInputElement).value).toBe(
      "",
    );
  });
});
