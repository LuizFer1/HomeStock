import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { TextField } from "./text-field";

afterEach(cleanup);

describe("TextField", () => {
  it("dense tem 44 px de altura minima e nao empilha a classe normal", () => {
    render(<TextField label="Validade" dense />);
    const input = screen.getByRole("textbox", { name: "Validade" });
    expect(input.className).toContain("min-h-11");
    expect(input.className).not.toContain("min-h-12");
  });

  it("icon envolve a entrada, com o icone decorativo a esquerda e pl-11 sem px", () => {
    render(<TextField label="Buscar" icon={<svg data-testid="lupa" />} />);
    const input = screen.getByRole("textbox", { name: "Buscar" });
    expect(input.className).toContain("pl-11");
    expect(input.className).not.toMatch(/(^| )px-/);
    const wrapper = input.parentElement as HTMLElement;
    expect(wrapper.className).toContain("relative");
    const icon = screen.getByTestId("lupa").parentElement as HTMLElement;
    expect(icon.getAttribute("aria-hidden")).toBe("true");
  });

  it("sem variante continua com a altura normal", () => {
    render(<TextField label="Nome" />);
    expect(screen.getByRole("textbox", { name: "Nome" }).className).toContain("min-h-12");
  });
});
