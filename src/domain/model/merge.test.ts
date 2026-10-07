import { describe, expect, it } from "vitest";
import type { BaseRow } from "./base";
import { mergeRow } from "./merge";

function row(updatedAt: string): BaseRow {
  return { id: "A", createdAt: "", updatedAt, deletedAt: null, dirty: 0, authorId: null };
}

describe("mergeRow", () => {
  it("sem local, fica a remota", () => {
    const remote = row("0000000000002-0000-X");
    expect(mergeRow(undefined, remote)).toBe(remote);
  });

  it("remota mais nova vence", () => {
    const remote = row("0000000000002-0000-X");
    expect(mergeRow(row("0000000000001-0000-X"), remote)).toBe(remote);
  });

  it("local mais nova vence", () => {
    const local = row("0000000000002-0000-X");
    expect(mergeRow(local, row("0000000000001-0000-X"))).toBe(local);
  });

  it("empate fica com a local", () => {
    const local = row("0000000000002-0000-X");
    expect(mergeRow(local, row("0000000000002-0000-X"))).toBe(local);
  });
});
