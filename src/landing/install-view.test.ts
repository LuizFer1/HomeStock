import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInstallFlow, type InstallPromptEvent } from "./install";
import { bindInstall, type InstallDeps } from "./install-view";
import { loadLanding } from "./landing-html.fake";
import type { Platform } from "./platform";

/** Janela falsa: guarda os ouvintes para o teste despachar eventos. */
function fakeWin() {
  const listeners = new Map<string, ((e: Event) => void)[]>();
  return {
    addEventListener(type: string, fn: (e: Event) => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), fn]);
    },
    fire(type: string, e: Event = new Event(type)) {
      for (const fn of listeners.get(type) ?? []) fn(e);
    },
  };
}

function setup(platform: Platform, over: Partial<InstallDeps> = {}) {
  const landing = loadLanding();
  document.body.innerHTML = landing.body.innerHTML;
  document.documentElement.removeAttribute("data-installed");
  const win = fakeWin();
  const flow = createInstallFlow();
  bindInstall(document, {
    platform,
    flow,
    standalone: false,
    win: win as unknown as Pick<Window, "addEventListener">,
    ...over,
  });
  return { win, flow };
}

const dialog = () => document.getElementById("instalar") as HTMLDialogElement;
const title = () => document.getElementById("instalar-titulo")?.textContent;
const panel = (name: string) => document.querySelector<HTMLElement>(`[data-steps="${name}"]`);
const button = (name: string) =>
  document.querySelector<HTMLElement>(`[data-install="${name}"]`) as HTMLElement;

function promptEvent(outcome: "accepted" | "dismissed" = "accepted") {
  const e = new Event("beforeinstallprompt") as InstallPromptEvent;
  e.prompt = vi.fn(async () => {});
  e.userChoice = Promise.resolve({ outcome });
  return e;
}

beforeEach(() => {
  document.body.innerHTML = "";
});

describe("bindInstall", () => {
  it("iOS marca a plataforma e abre o passo a passo do iPhone", () => {
    setup("ios");
    expect(document.documentElement.dataset.platform).toBe("ios");
    button("ios").click();
    expect(dialog().hasAttribute("open")).toBe(true);
    expect(panel("ios")?.hidden).toBe(false);
    expect(panel("android")?.hidden).toBe(true);
    expect(title()).toBe("Instalar no iPhone");
  });

  it("Android com evento capturado chama prompt e marca instalado", async () => {
    const { win } = setup("android");
    const e = promptEvent("accepted");
    win.fire("beforeinstallprompt", e);
    button("android").click();
    await vi.waitFor(() =>
      expect(document.documentElement.hasAttribute("data-installed")).toBe(true),
    );
    expect(e.prompt).toHaveBeenCalledOnce();
    expect(dialog().hasAttribute("open")).toBe(false);
  });

  it("Android que recusa o prompt nao faz nada", async () => {
    const { win } = setup("android");
    const e = promptEvent("dismissed");
    win.fire("beforeinstallprompt", e);
    button("android").click();
    await vi.waitFor(() => expect(e.prompt).toHaveBeenCalled());
    await Promise.resolve();
    expect(document.documentElement.hasAttribute("data-installed")).toBe(false);
    expect(dialog().hasAttribute("open")).toBe(false);
  });

  it("Android sem evento abre o passo a passo do Android", async () => {
    setup("android");
    button("android").click();
    await vi.waitFor(() => expect(dialog().hasAttribute("open")).toBe(true));
    expect(panel("android")?.hidden).toBe(false);
    expect(panel("ios")?.hidden).toBe(true);
    expect(title()).toBe("Instalar no Android");
  });

  it("standalone marca instalado", () => {
    setup("desktop", { standalone: true });
    expect(document.documentElement.hasAttribute("data-installed")).toBe(true);
  });

  it("appinstalled marca instalado", () => {
    const { win } = setup("android");
    expect(document.documentElement.hasAttribute("data-installed")).toBe(false);
    win.fire("appinstalled");
    expect(document.documentElement.hasAttribute("data-installed")).toBe(true);
  });
});
