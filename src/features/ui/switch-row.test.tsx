import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SwitchRow } from "./switch-row";

afterEach(cleanup);

describe("SwitchRow", () => {
  it("expoe o switch e reflete checked", () => {
    render(<SwitchRow label="Estoque baixo" checked onChange={() => {}} />);
    expect(
      (screen.getByRole("switch", { name: "Estoque baixo" }) as HTMLInputElement).checked,
    ).toBe(true);
  });

  it("clicar no rotulo desliga", () => {
    const onChange = vi.fn();
    render(<SwitchRow label="Estoque baixo" checked onChange={onChange} />);
    fireEvent.click(screen.getByText("Estoque baixo"));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it("a dica e descricao, nao nome", () => {
    render(
      <SwitchRow label="Estoque baixo" hint="Avisa quando acabar" checked onChange={() => {}} />,
    );
    const el = screen.getByRole("switch", { name: "Estoque baixo" });
    expect(el.getAttribute("aria-describedby")).toBeTruthy();
    const id = el.getAttribute("aria-describedby") as string;
    expect(document.getElementById(id)?.textContent).toBe("Avisa quando acabar");
  });
});
