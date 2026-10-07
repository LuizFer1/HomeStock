import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { testContext } from "../../app-context.fake";
import { isAlive } from "../../domain/model/base";
import { cafe } from "../../domain/model/item.fake";
import { listMarkId } from "../../domain/model/list-mark";
import { type ShoppingEntry, shoppingList } from "../../domain/projections/shopping";
import type { Session } from "../session/session";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ToastView } from "../shell/toast-view";
import { AdjustSheet } from "./adjust-sheet";

afterEach(cleanup);

const plain = (text: string | null) => (text ?? "").replaceAll(" ", " ");

function entriesOf(session: Session): ShoppingEntry[] {
  const d = session.data.value;
  const list = shoppingList({
    items: d.items,
    movements: d.movements,
    prices: d.prices,
    marks: d.listMarks,
    extras: d.listExtras,
    autoList: true,
  });
  return [...list.auto, ...list.house];
}

async function setup(
  seed: (session: Session) => Promise<void>,
  pick: (entries: ShoppingEntry[]) => ShoppingEntry,
) {
  const { session } = await openTestSession({ member: ANA });
  await seed(session);
  const { ctx } = testContext(session);
  const entry = pick(entriesOf(session));
  const onClose = vi.fn();
  const onGone = vi.fn();
  render(
    <>
      <AdjustSheet ctx={ctx} entry={entry} onClose={onClose} onGone={onGone} />
      <ToastView store={ctx.toast} raised={false} />
    </>,
  );
  return { session, ctx, entry, onClose, onGone };
}

const seedCafe = async (s: Session) => {
  await s.run((r) => r.createItem(cafe(), 1, 4290));
};
const first = (entries: ShoppingEntry[]) => entries[0] as ShoppingEntry;

function markOf(session: Session, itemId: string) {
  return session.data.value.listMarks.find((m) => m.id === listMarkId(itemId) && isAlive(m));
}

function typePrice(digits: string) {
  const input = screen.getByLabelText("Preço unitário") as HTMLInputElement;
  input.value = digits;
  fireEvent.input(input);
}

describe("AdjustSheet", () => {
  it("mostra stepper, meta, placeholder da estimativa e salva quantidade e preco", async () => {
    const { session, entry, onClose } = await setup(seedCafe, first);
    expect(
      screen.getByRole("heading", { level: 2, name: "Café em grãos Torrado 1 kg" }),
    ).toBeTruthy();
    expect(screen.getByText("Você tem 1 pct")).toBeTruthy();
    expect(screen.getByRole("group", { name: "Quantidade" }).textContent).toContain("3");
    expect(plain((screen.getByLabelText("Preço unitário") as HTMLInputElement).placeholder)).toBe(
      "R$ 42,90",
    );
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Quantidade" }));
    typePrice("399");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const mark = markOf(session, entry.id);
    expect(mark?.qty).toBe(4);
    expect(mark?.priceMinor).toBe(399);
  });

  it("quantidade de volta a sugerida grava null; preco apagado grava null", async () => {
    const { session, entry, onClose } = await setup(seedCafe, first);
    await session.run((r) => r.markItem(entry.id, { qty: 5, priceMinor: 100 }));
    cleanup();
    const { ctx } = testContext(session);
    const fresh = first(entriesOf(session));
    render(<AdjustSheet ctx={ctx} entry={fresh} onClose={onClose} onGone={() => {}} />);
    expect((screen.getByLabelText("Preço unitário") as HTMLInputElement).value).not.toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Quantidade" }));
    fireEvent.click(screen.getByRole("button", { name: "Diminuir Quantidade" }));
    typePrice("");
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    const mark = markOf(session, entry.id);
    expect(mark?.qty).toBeNull();
    expect(mark?.priceMinor).toBeNull();
  });

  it("Ver item fecha e empilha o item", async () => {
    const { ctx, entry, onClose } = await setup(seedCafe, first);
    fireEvent.click(screen.getByRole("button", { name: "Ver item" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(ctx.router.stack.value.at(-1)).toEqual({ kind: "item", id: entry.id });
  });

  it("item fixado acima do minimo: Tirar da lista apaga a marca, avisa e desfaz", async () => {
    const { session, entry, onGone } = await setup(
      async (s) => {
        const item = await s.run((r) => r.createItem(cafe(), 10));
        await s.run((r) => r.markItem(item.id, { pinned: 1 }));
      },
      (entries) => entries.find((e) => e.pinned) as ShoppingEntry,
    );
    expect(entry.section).toBe("house");
    fireEvent.click(screen.getByRole("button", { name: "Tirar da lista" }));
    expect(await screen.findByText("Café em grãos saiu da lista")).toBeTruthy();
    expect(onGone).toHaveBeenCalledTimes(1);
    expect(markOf(session, entry.id)).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(markOf(session, entry.id)?.pinned).toBe(1));
  });

  it("item automatico nao tem Tirar da lista nem Remover", async () => {
    await setup(seedCafe, first);
    expect(screen.queryByRole("button", { name: "Tirar da lista" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Remover da lista" })).toBeNull();
  });

  it("pedido: sem meta, Remover da lista apaga e Desfazer devolve", async () => {
    const { session, entry, onGone } = await setup(async (s) => {
      await s.run((r) => r.addListExtra("Banana"));
    }, first);
    expect(screen.queryByText(/Você tem/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Ver item" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Remover da lista" }));
    expect(await screen.findByText("Banana saiu da lista")).toBeTruthy();
    expect(onGone).toHaveBeenCalledTimes(1);
    const extra = () => session.data.value.listExtras.find((e) => e.id === entry.id);
    expect(extra()?.deletedAt).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Desfazer" }));
    await waitFor(() => expect(extra()?.deletedAt).toBeNull());
  });

  it("dois cliques em Salvar gravam uma vez", async () => {
    const { ctx, onClose } = await setup(seedCafe, first);
    const adjust = vi.spyOn(ctx.shopping, "adjust");
    fireEvent.click(screen.getByRole("button", { name: "Aumentar Quantidade" }));
    const save = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(adjust).toHaveBeenCalledTimes(1);
  });

  it("falha ao salvar mostra o erro focado e reabre a trava", async () => {
    const { ctx, onClose } = await setup(seedCafe, first);
    const adjust = vi.spyOn(ctx.shopping, "adjust").mockRejectedValueOnce(new Error("Sem espaço."));
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    const message = await screen.findByText("Sem espaço.");
    await waitFor(() => expect(document.activeElement).toBe(message.parentElement));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(adjust).toHaveBeenCalledTimes(2);
  });
});
