import "fake-indexeddb/auto";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { testContext } from "../../app-context.fake";
import type { Draft } from "../../domain/model/base";
import { isAlive } from "../../domain/model/base";
import type { Item } from "../../domain/model/item";
import { cafe } from "../../domain/model/item.fake";
import { ANA, openTestSession } from "../session/test-session.fake";
import { AddItemPage } from "./add-item-page";
import { type FakeScanner, fakeScanner } from "./scanner.fake";

afterEach(cleanup);

const KNOWN = "7891234567890";
const UNKNOWN = "7894900011517";

interface SetupOptions {
  kind?: "scan" | "item-new";
  /** Item cadastrado antes de abrir; null para nenhum. */
  draft?: Partial<Draft<Item>> | null;
  /** Leituras da camera, na ordem. */
  codes?: string[];
  /** false: testContext padrao, sem camera. */
  camera?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const { session } = await openTestSession({ member: ANA });
  const item =
    options.draft === null
      ? undefined
      : await session.run((repo) => repo.createItem(cafe(options.draft ?? {}), 2));
  const fake: FakeScanner = fakeScanner();
  fake.codes.push(...(options.codes ?? []));
  const { ctx } = testContext(session, options.camera === false ? {} : { scanner: fake.env });
  const kind = options.kind ?? "scan";
  ctx.router.push({ kind });
  const view = render(<AddItemPage ctx={ctx} kind={kind} />);
  const alive = () => session.data.value.items.filter((i) => isAlive(i));
  return { session, ctx, fake, item, view, alive };
}

function field(label: string): HTMLInputElement {
  return screen.getByLabelText(label) as HTMLInputElement;
}

function heading(): HTMLElement {
  return screen.getByRole("heading", { level: 1, name: "Novo item" });
}

function found(): Promise<HTMLElement> {
  return screen.findByText("Achamos! Café em grãos Torrado 1 kg");
}

describe("AddItemPage", () => {
  it("codigo conhecido mostra Achamos!, para a camera e oferece ler outro", async () => {
    const { fake } = await setup({ codes: [KNOWN] });
    expect(await found()).toBeTruthy();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Ler outro código" })).toBeTruthy();
    expect(document.activeElement).toBe(heading());
  });

  it("codigo desconhecido preenche o campo, mostra a nota, foca o Nome e cria", async () => {
    const { ctx, alive } = await setup({ draft: null, codes: [UNKNOWN] });
    await waitFor(() => expect(field("Código de barras").value).toBe(UNKNOWN));
    expect(screen.getByText(`Código ${UNKNOWN}`)).toBeTruthy();
    expect(screen.getByText("Item novo · preencha o nome")).toBeTruthy();
    expect(document.activeElement).toBe(field("Nome"));

    fireEvent.input(field("Nome"), { target: { value: "Leite" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar 1 un" }));
    await waitFor(() => expect(ctx.router.stack.value).toEqual([]));
    expect(alive().find((i) => i.name === "Leite")?.ean).toBe(UNKNOWN);
  });

  it("o mesmo codigo desconhecido lido de novo preenche e foca outra vez", async () => {
    const { fake } = await setup({ draft: null, codes: [UNKNOWN] });
    await waitFor(() => expect(field("Código de barras").value).toBe(UNKNOWN));
    fireEvent.input(field("Código de barras"), { target: { value: "" } });
    fake.codes.push(UNKNOWN);
    fireEvent.click(screen.getByRole("button", { name: "Ler outro código" }));
    await waitFor(() => expect(field("Código de barras").value).toBe(UNKNOWN));
    expect(document.activeElement).toBe(field("Nome"));
  });

  it("UPC-A lido como EAN-13 acha o item gravado com 12 digitos", async () => {
    await setup({ draft: { ean: "036000291452" }, codes: ["0036000291452"] });
    expect(await found()).toBeTruthy();
  });

  it("sem camera mostra a mensagem e o codigo digitado vira reposicao", async () => {
    await setup({ camera: false });
    expect(
      await screen.findByText("Este navegador não abre a câmera. Digite o código no campo abaixo."),
    ).toBeTruthy();
    fireEvent.input(field("Código de barras"), { target: { value: KNOWN } });
    fireEvent.change(field("Código de barras"), { target: { value: KNOWN } });
    expect(await found()).toBeTruthy();
  });

  it("codigo digitado desconhecido nao muda a tela", async () => {
    await setup({ camera: false, draft: null });
    fireEvent.input(field("Código de barras"), { target: { value: UNKNOWN } });
    fireEvent.change(field("Código de barras"), { target: { value: UNKNOWN } });
    expect(screen.queryByText(`Código ${UNKNOWN}`)).toBeNull();
    expect(field("Código de barras").value).toBe(UNKNOWN);
  });

  it("Ler outro código na reposicao reabre a camera; desconhecido volta ao criar", async () => {
    const { fake } = await setup({ codes: [KNOWN] });
    await found();
    fake.codes.push(UNKNOWN);
    fireEvent.click(screen.getByRole("button", { name: "Ler outro código" }));
    await waitFor(() => expect(field("Código de barras").value).toBe(UNKNOWN));
    expect(fake.openCamera).toHaveBeenCalledTimes(2);
    expect(screen.queryByText(/Achamos!/)).toBeNull();
    expect(screen.getByText(`Código ${UNKNOWN}`)).toBeTruthy();
    expect(document.activeElement).toBe(field("Nome"));
  });

  it("o mesmo item lido de novo recomeca a reposicao com o foco no titulo", async () => {
    const { fake } = await setup({ codes: [KNOWN] });
    await found();
    fake.codes.push(KNOWN);
    fireEvent.click(screen.getByRole("button", { name: "Ler outro código" }));
    await waitFor(() => expect(fake.streams[1]?.stop).toHaveBeenCalled());
    await waitFor(() => expect(document.activeElement).toBe(heading()));
    expect(screen.getByRole("button", { name: "Ler outro código" })).toBeTruthy();
  });

  it("item-new nao abre a camera, mostra Ler código e foca o Nome", async () => {
    const { fake } = await setup({ kind: "item-new" });
    expect(screen.getByRole("button", { name: "Ler código" })).toBeTruthy();
    expect(document.activeElement).toBe(field("Nome"));
    await act(async () => {});
    expect(fake.openCamera).not.toHaveBeenCalled();
  });

  it("scan antes de ler foca o titulo, nao o Nome", async () => {
    await setup();
    expect(document.activeElement).toBe(heading());
  });

  it("desmontar durante a leitura para a track", async () => {
    const { fake, view } = await setup();
    await waitFor(() => expect(fake.streams).toHaveLength(1));
    await screen.findByText("Aponte para o código de barras");
    view.unmount();
    expect(fake.streams[0]?.stop).toHaveBeenCalled();
  });

  it("item achado apagado com a reposicao aberta volta ao criar", async () => {
    const { session, item } = await setup({ codes: [KNOWN] });
    await found();
    await act(async () => {
      await session.run((repo) => repo.deleteItem(item?.id ?? ""));
    });
    await waitFor(() => expect(screen.queryByText(/Achamos!/)).toBeNull());
    expect(field("Nome")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ler outro código" })).toBeTruthy();
  });
});
