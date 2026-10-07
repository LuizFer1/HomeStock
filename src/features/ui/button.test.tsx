import { describe, expect, it } from "vitest";
import { BTN_GHOST, BTN_PRIMARY } from "./button";

describe("classes de botao", () => {
  it("ghost nao herda o padding largo", () => {
    expect(BTN_GHOST).not.toContain("px-5");
    expect(BTN_GHOST).toContain("px-2");
  });

  it("primario mantem o padding largo", () => {
    expect(BTN_PRIMARY).toContain("px-5");
  });
});
