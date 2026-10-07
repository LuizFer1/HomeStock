import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ANA } from "../session/test-session.fake";
import { MemberWizard, type MemberWizardProps } from "./member-wizard";

const PHOTO = "data:image/webp;base64,AAA";

function setup(props: Partial<MemberWizardProps> = {}) {
  const onSubmit = vi.fn(async () => {});
  const processFile = vi.fn(async () => PHOTO);
  render(<MemberWizard mode="create" onSubmit={onSubmit} processFile={processFile} {...props} />);
  return { onSubmit, processFile };
}

function type(name: string) {
  fireEvent.input(screen.getByLabelText("Seu nome"), { target: { value: name } });
}

function next() {
  fireEvent.click(screen.getByRole("button", { name: "Continuar" }));
}

function upload(label: string) {
  const input = screen
    .getByText(label)
    .closest("label")
    ?.querySelector("input") as HTMLInputElement;
  fireEvent.change(input, { target: { files: [new File(["x"], "a.png")] } });
}

afterEach(cleanup);

describe("MemberWizard", () => {
  it("Continuar fica desabilitado sem nome e a previa mostra o nome", () => {
    setup();
    const cta = screen.getByRole("button", { name: "Continuar" }) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    type("Ana");
    expect(cta.disabled).toBe(false);
    expect(screen.getByText("Ana")).toBeTruthy();
    expect(screen.getByText("Bem-vindo ao HomeStock")).toBeTruthy();
  });

  it("avanca ate Pronto e envia o rascunho com a cor escolhida", async () => {
    const { onSubmit } = setup();
    type("  Ana ");
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Sálvia" }));
    next();
    next();
    expect(screen.getByText("Tudo pronto, Ana!")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no HomeStock" }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: "Ana", color: "salvia", photo: null }),
    );
  });

  it("Voltar no passo 2 volta ao 1 mantendo a cor", () => {
    setup();
    type("Ana");
    next();
    fireEvent.click(screen.getByRole("radio", { name: "Musgo" }));
    next();
    expect(screen.getByText("Um sorriso pra casa")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText("Qual é a sua cor?")).toBeTruthy();
    expect((screen.getByRole("radio", { name: "Musgo" }) as HTMLInputElement).checked).toBe(true);
  });

  it("upload mostra a foto", async () => {
    setup();
    type("Ana");
    next();
    next();
    upload("Galeria");
    expect(await screen.findByAltText("Foto de Ana")).toBeTruthy();
  });

  it("falha na foto mostra o alerta", async () => {
    setup({
      processFile: async () => {
        throw new Error("Foto grande demais.");
      },
    });
    type("Ana");
    next();
    next();
    upload("Câmera");
    expect((await screen.findByRole("alert")).textContent).toBe("Foto grande demais.");
  });

  it("Usar so a inicial limpa a foto e vai para Pronto", async () => {
    const { onSubmit } = setup();
    type("Ana");
    next();
    next();
    upload("Galeria");
    await screen.findByAltText("Foto de Ana");
    fireEvent.click(screen.getByRole("button", { name: "Usar só a inicial" }));
    expect(screen.getByText("Tudo pronto, Ana!")).toBeTruthy();
    expect(screen.queryByAltText("Foto de Ana")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no HomeStock" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(ANA));
  });

  it("onSubmit rejeitando mostra o erro e fica no passo", async () => {
    setup({
      onSubmit: async () => {
        throw new Error("Disco cheio");
      },
    });
    type("Ana");
    next();
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no HomeStock" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Disco cheio");
    expect(screen.getByText("Tudo pronto, Ana!")).toBeTruthy();
  });

  it("modo editar parte de initial, cancela no passo 0 e salva no passo 2", async () => {
    const onCancel = vi.fn();
    const { onSubmit } = setup({ mode: "edit", initial: ANA, onCancel });
    expect((screen.getByLabelText("Seu nome") as HTMLInputElement).value).toBe("Ana");
    expect(screen.queryByText("Bem-vindo ao HomeStock")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Salvar" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(ANA));
    expect(screen.queryByText("Tudo pronto, Ana!")).toBeNull();
  });

  it("duplo toque em Salvar envia uma vez so", async () => {
    let release: () => void = () => {};
    const onSubmit = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          release = resolve;
        }),
    );
    setup({ mode: "edit", initial: ANA, onSubmit });
    next();
    next();
    const save = screen.getByRole("button", { name: "Salvar" });
    fireEvent.click(save);
    fireEvent.click(save);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    release();
  });

  it("foto que chega depois de Usar so a inicial nao ressuscita", async () => {
    let finish: (photo: string) => void = () => {};
    const processFile = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
    );
    const { onSubmit } = setup({ processFile });
    type("Ana");
    next();
    next();
    upload("Galeria");
    fireEvent.click(screen.getByRole("button", { name: "Usar só a inicial" }));
    finish(PHOTO);
    await Promise.resolve();
    await Promise.resolve();
    fireEvent.click(screen.getByRole("button", { name: "Entrar no HomeStock" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(ANA));
  });

  it("falha na foto mantem a foto anterior", async () => {
    const processFile = vi.fn(async () => PHOTO);
    setup({ processFile });
    type("Ana");
    next();
    next();
    upload("Galeria");
    await screen.findByAltText("Foto de Ana");
    processFile.mockRejectedValueOnce(new Error("Falhou"));
    upload("Galeria");
    expect((await screen.findByRole("alert")).textContent).toBe("Falhou");
    expect(screen.getByAltText("Foto de Ana")).toBeTruthy();
  });

  it("Usar so a inicial no modo editar envia photo null", async () => {
    const { onSubmit } = setup({ mode: "edit", initial: { ...ANA, photo: PHOTO } });
    next();
    next();
    fireEvent.click(screen.getByRole("button", { name: "Usar só a inicial" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(ANA));
  });

  it("Enter no campo de nome avanca", () => {
    setup();
    type("Ana");
    fireEvent.keyDown(screen.getByLabelText("Seu nome"), { key: "Enter" });
    expect(screen.getByText("Qual é a sua cor?")).toBeTruthy();
  });

  it("o titulo do passo recebe foco ao avancar", () => {
    setup();
    type("Ana");
    next();
    expect(document.activeElement).toBe(screen.getByText("Qual é a sua cor?"));
  });
});
