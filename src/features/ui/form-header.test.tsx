import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { createRef } from "preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormHeader } from "./form-header";

afterEach(cleanup);

describe("FormHeader", () => {
  it("titulo focavel pelo ref, descricao opcional e Fechar", () => {
    const ref = createRef<HTMLHeadingElement>();
    const onClose = vi.fn();
    render(<FormHeader title="Novo item" headingRef={ref} describedBy="d1" onClose={onClose} />);
    const h1 = screen.getByRole("heading", { level: 1, name: "Novo item" });
    expect(ref.current).toBe(h1);
    expect(h1.getAttribute("tabindex")).toBe("-1");
    expect(h1.getAttribute("aria-describedby")).toBe("d1");
    fireEvent.click(screen.getByRole("button", { name: "Fechar" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
