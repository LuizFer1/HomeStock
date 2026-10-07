import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { StatusPill } from "./status-pill";

afterEach(cleanup);

describe("StatusPill", () => {
  it("status com titulo e subtitulo no bloco de texto com id", () => {
    render(
      <StatusPill
        tone="found"
        icon={<i />}
        title="Achamos! Café"
        subtitle="Vamos somar"
        textId="t1"
      />,
    );
    const pill = screen.getByRole("status");
    expect(pill.classList.contains("bg-accent-2-200")).toBe(true);
    expect(document.getElementById("t1")?.textContent).toBe("Achamos! CaféVamos somar");
  });

  it("tom neutro usa a superficie", () => {
    render(<StatusPill tone="neutral" icon={<i />} title="Código 1" subtitle="Novo" textId="t2" />);
    expect(screen.getByRole("status").classList.contains("bg-surface")).toBe(true);
  });
});
