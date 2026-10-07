import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { useState } from "preact/hooks";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PriceField } from "./price-field";

afterEach(cleanup);

function Harness(props: { onChange: (text: string, minor: number | null) => void }) {
  const [text, setText] = useState("");
  return (
    <>
      <label htmlFor="p">Preço</label>
      <PriceField
        id="p"
        value={text}
        onChange={(next, minor) => {
          setText(next);
          props.onChange(next, minor);
        }}
      />
    </>
  );
}

describe("PriceField", () => {
  it("digitar 4290 mostra R$ 42,90 e avisa os centavos", () => {
    const onChange = vi.fn();
    render(<Harness onChange={onChange} />);
    const input = screen.getByLabelText("Preço") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "4290" } });
    expect(input.value.replace(/ /g, " ")).toBe("R$ 42,90");
    expect(onChange).toHaveBeenLastCalledWith(expect.any(String), 4290);
    expect(input.placeholder.replace(/ /g, " ")).toBe("R$ 0,00");
  });

  it("uma letra num campo vazio deixa o DOM vazio", () => {
    render(<Harness onChange={() => {}} />);
    const input = screen.getByLabelText("Preço") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "a" } });
    expect(input.value).toBe("");
  });
});
