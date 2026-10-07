import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ColorSwatches } from "./color-swatches";

afterEach(cleanup);

describe("ColorSwatches", () => {
  it("mostra 8 radios e marca o atual", () => {
    render(<ColorSwatches value="musgo" onChange={() => {}} legend="Cor" />);
    expect(screen.getAllByRole("radio")).toHaveLength(8);
    expect((screen.getByRole("radio", { name: "Musgo" }) as HTMLInputElement).checked).toBe(true);
    expect((screen.getByRole("radio", { name: "Café" }) as HTMLInputElement).checked).toBe(false);
  });

  it("clicar chama onChange", () => {
    const onChange = vi.fn();
    render(<ColorSwatches value="terracota" onChange={onChange} legend="Cor" />);
    fireEvent.click(screen.getByRole("radio", { name: "Sálvia" }));
    expect(onChange).toHaveBeenCalledWith("salvia");
  });
});
