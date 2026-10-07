import { cleanup, render, screen } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { Avatar, initialOf } from "./avatar";

afterEach(cleanup);

describe("initialOf", () => {
  it("usa a primeira letra maiuscula", () => {
    expect(initialOf("  ana")).toBe("A");
  });

  it("sem nome vira interrogacao", () => {
    expect(initialOf("")).toBe("?");
  });
});

describe("Avatar", () => {
  it("sem foto mostra a inicial e o nome como rotulo", () => {
    render(<Avatar name="ana" color="terracota" photo={null} size={40} />);
    const el = screen.getByRole("img", { name: "ana" });
    expect(el.textContent).toBe("A");
  });

  it("foto webp vira img", () => {
    render(<Avatar name="Ana" color="terracota" photo="data:image/webp;base64,AAAA" size={40} />);
    expect(screen.getByAltText("Foto de Ana")).toBeTruthy();
  });

  it("svg cai na inicial", () => {
    render(
      <Avatar name="Ana" color="terracota" photo="data:image/svg+xml;base64,AAAA" size={40} />,
    );
    expect(screen.queryByAltText("Foto de Ana")).toBeNull();
    expect(screen.getByRole("img", { name: "Ana" }).textContent).toBe("A");
  });

  it("damasco usa tinta escura", () => {
    render(<Avatar name="Ana" color="damasco" photo={null} size={40} />);
    const el = screen.getByRole("img", { name: "Ana" }) as HTMLElement;
    expect(el.style.color).toBe("var(--color-text)");
  });
});
