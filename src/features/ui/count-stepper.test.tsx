import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CountStepper } from "./count-stepper";

afterEach(cleanup);

describe("CountStepper", () => {
  it("dois steppers na mesma tela tem botoes com nomes distintos", () => {
    render(
      <>
        <CountStepper label="Mínimo" value={1} min={0} onChange={() => {}} />
        <CountStepper label="Compra usual" value={2} min={1} onChange={() => {}} />
      </>,
    );
    expect(screen.getByRole("button", { name: "Diminuir Mínimo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar Mínimo" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Diminuir Compra usual" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Aumentar Compra usual" })).toBeTruthy();
    expect(screen.getByRole("group", { name: "Mínimo" })).toBeTruthy();
  });

  it("mostra o valor e o hint", () => {
    render(
      <CountStepper
        label="Mínimo"
        hint="Avisa abaixo disto"
        value={3}
        min={0}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("group", { name: "Mínimo" }).querySelector("output")?.textContent).toBe(
      "3",
    );
    expect(screen.getByText("Avisa abaixo disto")).toBeTruthy();
  });

  it("Diminuir fica desabilitado em min", () => {
    const onChange = vi.fn();
    render(<CountStepper label="Mínimo" value={0} min={0} onChange={onChange} />);
    const dec = screen.getByRole("button", { name: "Diminuir Mínimo" }) as HTMLButtonElement;
    expect(dec.disabled).toBe(true);
    fireEvent.click(dec);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("Diminuir chama onChange(value - 1)", () => {
    const onChange = vi.fn();
    render(<CountStepper label="Mínimo" value={2} min={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Mínimo" }));
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("Aumentar chama onChange(value + 1)", () => {
    const onChange = vi.fn();
    render(<CountStepper label="Mínimo" value={2} min={0} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Mínimo" }));
    expect(onChange).toHaveBeenCalledWith(3);
  });

  it("Aumentar fica desabilitado em max, e o padrao e 999", () => {
    const { rerender } = render(
      <CountStepper label="Mínimo" value={5} min={0} max={5} onChange={() => {}} />,
    );
    const inc = () => screen.getByRole("button", { name: "Aumentar Mínimo" }) as HTMLButtonElement;
    expect(inc().disabled).toBe(true);
    rerender(<CountStepper label="Mínimo" value={998} min={0} onChange={() => {}} />);
    expect(inc().disabled).toBe(false);
    rerender(<CountStepper label="Mínimo" value={999} min={0} onChange={() => {}} />);
    expect(inc().disabled).toBe(true);
  });
});
