import { describe, expect, it } from "vitest";
import type { Member } from "../../domain/model/member";
import type { ShoppingEntry } from "../../domain/projections/shopping";
import {
  checkoutMessage,
  entryMeta,
  entryPrice,
  entryTitle,
  footerLabel,
  householdAvatars,
  progressLabel,
  reasonLabel,
  requesterName,
  unpricedLabel,
} from "./labels";

function member(id: string, name: string, deletedAt: string | null = null): Member {
  return {
    id,
    createdAt: "2026-10-01T12:00:00.000Z",
    updatedAt: "0000000000001-0000-00000000000000000000000000",
    deletedAt,
    dirty: 0,
    authorId: id,
    name,
    color: "terracota",
    photo: null,
    role: "member",
  };
}

function entry(overrides: Partial<ShoppingEntry> = {}): ShoppingEntry {
  return {
    key: "item:I",
    kind: "item",
    id: "I",
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

const plain = (s: string | undefined) => s?.replaceAll(" ", " ");
const ANA = member("ANA", "Ana");

describe("checkoutMessage", () => {
  const cafe = { qty: 3, unit: "pct", name: "Café em grãos" };
  it.each([
    [[cafe], 0, "Guardou 3 pct de Café em grãos"],
    [[cafe, cafe], 0, "Guardou 2 itens no estoque"],
    [[], 1, "1 pedido saiu da lista"],
    [[], 2, "2 pedidos saíram da lista"],
    [[cafe], 1, "Guardou 1 item · 1 pedido saiu da lista"],
    [[cafe, cafe, cafe], 2, "Guardou 3 itens · 2 pedidos saíram da lista"],
  ])("%j + %i pedidos", (items, extras, text) => {
    expect(checkoutMessage(items, extras)).toBe(text);
  });

  it("item sem unidade nao deixa espaco sobrando", () => {
    expect(checkoutMessage([{ qty: 2, unit: "", name: "Pão" }], 0)).toBe("Guardou 2 de Pão");
  });
});

describe("entryMeta", () => {
  it("automatico, item fixado e pedido avulso", () => {
    expect(entryMeta(entry(), [ANA])).toBe("3 pct · Abaixo do mínimo");
    expect(entryMeta(entry({ reason: "out" }), [ANA])).toBe("3 pct · Esgotado");
    expect(entryMeta(entry({ section: "house", reason: null, requestedBy: "ANA" }), [ANA])).toBe(
      "3 pct · pedido por Ana",
    );
    expect(
      entryMeta(
        entry({ kind: "extra", unit: "", size: "", qty: 2, reason: null, requestedBy: "ANA" }),
        [ANA],
      ),
    ).toBe("2 · pedido por Ana");
  });
});

describe("requesterName", () => {
  it("morador apagado, ausente ou null vira outro morador", () => {
    expect(requesterName("ANA", [ANA])).toBe("Ana");
    expect(requesterName("ANA", [member("ANA", "Ana", "x")])).toBe("outro morador");
    expect(requesterName("ZZ", [ANA])).toBe("outro morador");
    expect(requesterName(null, [ANA])).toBe("outro morador");
  });
});

describe("entryPrice", () => {
  it("digitado, estimado e nenhum", () => {
    const typed = entryPrice(entry({ qty: 2, priceMinor: 4290 }));
    expect(plain(typed?.text)).toBe("R$ 85,80");
    expect(typed?.estimate).toBe(false);
    const est = entryPrice(entry({ qty: 2, estimateMinor: 4290 }));
    expect(plain(est?.text)).toBe("~R$ 85,80");
    expect(est?.estimate).toBe(true);
    expect(entryPrice(entry())).toBeNull();
  });
});

describe("rotulos simples", () => {
  it("titulo, motivo, progresso, rodape e sem preco", () => {
    expect(entryTitle(entry())).toBe("Café em grãos Torrado 1 kg");
    expect(entryTitle({ name: "Banana", size: "" })).toBe("Banana");
    expect(reasonLabel("out")).toBe("Esgotado");
    expect(progressLabel(2, 6)).toBe("2 de 6");
    expect(footerLabel("")).toBe("Falta comprar");
    expect(footerLabel("Atacadão")).toBe("Falta comprar · Atacadão");
    expect(unpricedLabel(1)).toBe("+ 1 sem preço");
    expect(unpricedLabel(3)).toBe("+ 3 sem preço");
  });
});

describe("householdAvatars", () => {
  it("devolve ate 3, o local primeiro, sem apagados", () => {
    const all = [
      member("D", "Dani"),
      member("C", "Caio"),
      member("B", "Bia"),
      member("A", "Ana"),
      member("X", "Xuxa", "x"),
    ];
    expect(householdAvatars(all, "D").map((m) => m.name)).toEqual(["Dani", "Ana", "Bia"]);
    expect(householdAvatars(all, null).map((m) => m.name)).toEqual(["Ana", "Bia", "Caio"]);
  });
});
