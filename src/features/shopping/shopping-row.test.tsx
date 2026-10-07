import { cleanup, fireEvent, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ShoppingEntry } from "../../domain/projections/shopping";
import { ShoppingRow } from "./shopping-row";

afterEach(cleanup);

const META = "3 pct · Abaixo do mínimo";
const NAME = `Café em grãos Torrado 1 kg, ${META}`;

function entry(overrides: Partial<ShoppingEntry> = {}): ShoppingEntry {
  return {
    key: "item:01",
    kind: "item",
    id: "01",
    section: "auto",
    name: "Café em grãos",
    size: "Torrado 1 kg",
    unit: "pct",
    qty: 3,
    suggestion: 3,
    have: 1,
    reason: "low",
    requestedBy: null,
    pinned: false,
    checked: false,
    priceMinor: null,
    estimateMinor: null,
    ...overrides,
  };
}

describe("ShoppingRow", () => {
  it("desmarcada: checkbox com o nome e a meta, sem o check", () => {
    render(<ShoppingRow entry={entry()} meta={META} onToggle={() => {}} />);
    const box = screen.getByRole("checkbox", { name: NAME });
    expect(box.getAttribute("aria-checked")).toBe("false");
    expect(box.querySelector("svg")).toBeNull();
    expect(screen.getByText(META)).toBeTruthy();
    const row = box.parentElement as HTMLElement;
    expect(row.className).not.toContain("opacity-[0.55]");
  });

  it("marcada: aria-checked, opacidade e nome riscado", () => {
    render(<ShoppingRow entry={entry({ checked: true })} meta={META} onToggle={() => {}} />);
    const box = screen.getByRole("checkbox", { name: NAME });
    expect(box.getAttribute("aria-checked")).toBe("true");
    expect(box.querySelector("svg")).not.toBeNull();
    expect((box.parentElement as HTMLElement).className).toContain("opacity-[0.55]");
    expect(screen.getByText("Café em grãos Torrado 1 kg").className).toContain("line-through");
  });

  it("o clique chama onToggle", () => {
    const onToggle = vi.fn();
    render(<ShoppingRow entry={entry()} meta={META} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("checkbox", { name: NAME }));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("preco digitado mostra o total da linha", () => {
    render(<ShoppingRow entry={entry({ priceMinor: 4290 })} meta={META} onToggle={() => {}} />);
    const price = screen.getByText("R$ 128,70");
    expect(price.getAttribute("aria-hidden")).toBe("true");
    expect(price.className).not.toContain("text-neutral-700");
  });

  it("preco estimado leva til e neutral-700", () => {
    render(<ShoppingRow entry={entry({ estimateMinor: 3990 })} meta={META} onToggle={() => {}} />);
    expect(screen.getByText("~R$ 119,70").className).toContain("text-neutral-700");
  });
});
