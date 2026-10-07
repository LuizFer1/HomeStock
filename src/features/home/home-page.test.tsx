import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { testContext } from "../../app-context.fake";
import { cafe } from "../../domain/model/item.fake";
import { putRafa } from "../alerts/activity.fake";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { HomePage } from "./home-page";

afterEach(cleanup);

async function setup(seed: (session: Session) => Promise<void> = async () => {}) {
  const { db, session } = await openTestSession({ member: ANA });
  await seed(session);
  const made = testContext(session);
  const view = render(<HomePage ctx={made.ctx} />);
  return { db, session, ...made, view };
}

const seedCafeArroz = async (s: Session) => {
  await s.run((r) => r.createItem(cafe(), 1, 4290));
  await s.run((r) => r.createItem(cafe({ name: "Arroz", min: 1, ean: null }), 3));
};

const idOf = (s: Session, name: string) => {
  const item = s.data.value.items.find((i) => i.name === name);
  if (item === undefined) throw new Error(`${name} nao achado`);
  return item.id;
};

const seedIogurte = async (s: Session) => {
  await s.run((r) =>
    r.createItem(
      cafe({ name: "Iogurte", unit: "un", min: 0, expiresAt: "2026-10-07", ean: null }),
      2,
    ),
  );
};

describe("HomePage", () => {
  it("sem itens: saudacao, anel vazio, contadores zerados e sino sem ponto", async () => {
    const { view } = await setup();
    expect(screen.getByRole("heading", { level: 1, name: "Oi, Ana!" })).toBeTruthy();
    expect(screen.getByText("Seu estoque ainda está vazio.")).toBeTruthy();
    const ring = screen.getByRole("img", { name: "Saúde do estoque: sem itens" });
    expect(ring.textContent).toContain("—");
    expect(screen.getByText("R$ 0,00")).toBeTruthy();
    expect(screen.getByText("0 itens · 0 em dia")).toBeTruthy();
    for (const name of ["0 acabando", "0 vencendo", "0 na lista"]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
    expect(screen.getByText("Seu estoque está vazio.")).toBeTruthy();
    const bell = screen.getByRole("button", { name: "Alertas" });
    expect(bell.querySelector(".bg-accent")).toBeNull();
    expect(view.container.querySelector("circle.text-accent-2-700")).toBeNull();
  });

  it("com itens: saude, valor, contadores, linha de Acabando e sino com ponto", async () => {
    await setup(seedCafeArroz);
    expect(screen.getByRole("img", { name: "Saúde do estoque: 50%" })).toBeTruthy();
    expect(screen.getByText("R$ 42,90")).toBeTruthy();
    expect(screen.getByText("2 itens · 1 em dia")).toBeTruthy();
    expect(screen.getByText("Alguns itens pedem atenção.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 acabando" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "1 na lista" })).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Café em grãos, 1 pct, Abaixo do mínimo" }),
    ).toBeTruthy();
    const bell = screen.getByRole("button", { name: "Alertas, 1 pendente" });
    expect(bell.querySelector("span.bg-accent")).not.toBeNull();
  });

  it("acabando e Ver estoque abrem o Estoque limpando filtro e busca", async () => {
    for (const name of ["1 acabando", "Ver estoque"]) {
      const { ctx } = await setup(seedCafeArroz);
      ctx.stock.filter.value = "cat:x";
      ctx.stock.query.value = "café";
      fireEvent.click(screen.getByRole("button", { name }));
      expect(ctx.router.tab.value).toBe("stock");
      expect(ctx.stock.filter.value).toBe("all");
      expect(ctx.stock.query.value).toBe("");
      cleanup();
    }
  });

  it("na lista abre Compras", async () => {
    const { ctx } = await setup(seedCafeArroz);
    fireEvent.click(screen.getByRole("button", { name: "1 na lista" }));
    expect(ctx.router.tab.value).toBe("shopping");
  });

  it("vencendo abre Alertas; com o alerta desligado, o Estoque", async () => {
    const { ctx, session } = await setup(seedIogurte);
    fireEvent.click(screen.getByRole("button", { name: "1 vencendo" }));
    expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "alerts" });
    expect(ctx.home.returnFocus.value).toBe("counter-expiring");
    cleanup();

    await session.run((r) => r.setPref("alertExpiring", false));
    const again = testContext(session);
    render(<HomePage ctx={again.ctx} />);
    fireEvent.click(screen.getByRole("button", { name: "1 vencendo" }));
    expect(again.ctx.router.tab.value).toBe("stock");
    expect(again.ctx.router.stack.value).toEqual([]);
  });

  it("sino, linha do cafe e moradores empilham a tela certa", async () => {
    const { ctx, session } = await setup(seedCafeArroz);
    fireEvent.click(screen.getByRole("button", { name: "Alertas, 1 pendente" }));
    expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "alerts" });
    expect(ctx.home.returnFocus.value).toBe("alerts");

    fireEvent.click(screen.getByRole("button", { name: "Café em grãos, 1 pct, Abaixo do mínimo" }));
    const id = idOf(session, "Café em grãos");
    expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "item", id });
    expect(ctx.home.returnFocus.value).toBe(`item:${id}`);

    fireEvent.click(screen.getByRole("button", { name: "Ajustes" }));
    expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "settings" });
    expect(ctx.home.returnFocus.value).toBe("settings");
  });

  it("remontar foca o controle guardado e zera o sinal", async () => {
    const { ctx, session, view } = await setup(seedCafeArroz);
    view.unmount();
    ctx.home.returnFocus.value = "alerts";
    render(<HomePage ctx={ctx} />);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: /^Alertas/ }));
    expect(ctx.home.returnFocus.value).toBeNull();

    cleanup();
    // O item saiu de Acabando: sem o controle, o foco vai ao titulo.
    await session.run((r) => r.restock(idOf(session, "Café em grãos"), 5));
    ctx.home.returnFocus.value = `item:${idOf(session, "Café em grãos")}`;
    render(<HomePage ctx={ctx} />);
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
    expect(ctx.home.returnFocus.value).toBeNull();
  });

  it("mostra so 4 linhas em Acabando, esgotados primeiro", async () => {
    await setup(async (s) => {
      for (const name of ["A", "B", "C", "D"]) {
        await s.run((r) => r.createItem(cafe({ name, min: 2, ean: null }), 1));
      }
      await s.run((r) => r.createItem(cafe({ name: "Z", min: 2, ean: null }), 0));
    });
    const rows = screen
      .getAllByRole("button")
      .filter((b) => /, (Esgotado|Abaixo do mínimo)$/.test(b.getAttribute("aria-label") ?? ""));
    expect(rows).toHaveLength(4);
    expect(rows[0]?.getAttribute("aria-label")).toBe("Z, 0 pct, Esgotado");
  });

  it("alertLow desligado apaga o ponto mas o contador continua", async () => {
    await setup(async (s) => {
      await seedCafeArroz(s);
      await s.run((r) => r.setPref("alertLow", false));
    });
    const bell = screen.getByRole("button", { name: "Alertas" });
    expect(bell.querySelector("span.bg-accent")).toBeNull();
    expect(screen.getByRole("button", { name: "1 acabando" })).toBeTruthy();
  });

  it("moradores: Ana primeiro e Rafa com margem negativa dentro do botao Ajustes", async () => {
    const { db, session, ctx } = await setup();
    await putRafa(db);
    await session.reload();
    cleanup();
    render(<HomePage ctx={ctx} />);
    const button = screen.getByRole("button", { name: "Ajustes" });
    const avatars = within(button).getAllByRole("img");
    expect(avatars.map((a) => a.getAttribute("aria-label"))).toEqual(["Ana", "Rafa"]);
    expect(avatars[1]?.className).toContain("-ml-3");
  });
});
