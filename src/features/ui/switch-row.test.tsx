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
});
