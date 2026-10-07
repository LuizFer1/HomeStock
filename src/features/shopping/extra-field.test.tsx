import "fake-indexeddb/auto";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it } from "vitest";
import { testContext } from "../../app-context.fake";
import { isAlive } from "../../domain/model/base";
import { ANA, openTestSession } from "../session/test-session.fake";
import { ExtraField } from "./extra-field";

afterEach(cleanup);

async function setup() {
  const { session } = await openTestSession({ member: ANA });
  const { ctx } = testContext(session);
  render(<ExtraField ctx={ctx} />);
  const input = screen.getByLabelText("Novo pedido da casa") as HTMLInputElement;
  const type = (text: string) => {
    input.value = text;
    fireEvent.input(input);
  };
  const names = () => session.data.value.listExtras.filter((e) => isAlive(e)).map((e) => e.name);
  return { session, input, type, names };
}

describe("ExtraField", () => {
  it("Enter grava o pedido, limpa o campo e o foco fica nele", async () => {
    const { input, type, names } = await setup();
    expect(input.placeholder).toBe("Pedir algo para a casa");
    type("Banana");
    fireEvent.submit(input.closest("form") as HTMLFormElement);
    await waitFor(() => expect(names()).toEqual(["Banana"]));
    await waitFor(() => expect(input.value).toBe(""));
    expect(document.activeElement).toBe(input);
  });

  it("campo vazio mostra o erro", async () => {
    const { input } = await setup();
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pedido" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Dê um nome ao pedido.");
    expect(document.activeElement).toBe(input);
  });

  it("repetido (sem acento) mostra o nome normalizado", async () => {
    const { type, names } = await setup();
    type("Banana");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pedido" }));
    await waitFor(() => expect(names()).toEqual(["Banana"]));
    type("banána");
    fireEvent.click(screen.getByRole("button", { name: "Adicionar pedido" }));
    expect((await screen.findByRole("alert")).textContent).toBe("banána já está na lista.");
    expect(names()).toEqual(["Banana"]);
  });

  it("dois envios seguidos gravam um pedido so", async () => {
    const { type, names } = await setup();
    type("Banana");
    const add = screen.getByRole("button", { name: "Adicionar pedido" });
    fireEvent.click(add);
    fireEvent.click(add);
    await waitFor(() => expect(names()).toEqual(["Banana"]));
  });
});
