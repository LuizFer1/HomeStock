import { bindDialog } from "./dialog";
import type { createInstallFlow, InstallPromptEvent } from "./install";
import type { Platform } from "./platform";

export interface InstallDeps {
  platform: Platform;
  flow: ReturnType<typeof createInstallFlow>;
  /** matchMedia("(display-mode: standalone)").matches */
  standalone: boolean;
  win: Pick<Window, "addEventListener">;
}

const TITLES = { ios: "Instalar no iPhone", android: "Instalar no Android" } as const;

/** Marca html[data-platform]/[data-installed], liga os CTAs e o dialogo #instalar. */
export function bindInstall(doc: Document, deps: InstallDeps): void {
  const root = doc.documentElement;
  const markInstalled = () => {
    root.dataset.installed = "";
  };

  root.dataset.platform = deps.platform;
  if (deps.standalone) markInstalled();

  deps.win.addEventListener("appinstalled", markInstalled);
  deps.win.addEventListener("beforeinstallprompt", (e) =>
    deps.flow.capture(e as InstallPromptEvent),
  );

  const dialog = doc.getElementById("instalar") as HTMLDialogElement | null;
  if (!dialog) return;
  const modal = bindDialog(dialog);
  const heading = doc.getElementById("instalar-titulo");

  const showSteps = (which: "ios" | "android", opener: HTMLElement | null) => {
    for (const panel of dialog.querySelectorAll<HTMLElement>("[data-steps]")) {
      panel.hidden = panel.dataset.steps !== which;
    }
    if (heading) heading.textContent = TITLES[which];
    modal.open(opener);
  };

  for (const btn of doc.querySelectorAll<HTMLElement>('[data-install="ios"]')) {
    btn.addEventListener("click", () => showSteps("ios", btn));
  }
  for (const btn of doc.querySelectorAll<HTMLElement>('[data-install="android"]')) {
    btn.addEventListener("click", async () => {
      const result = await deps.flow.install();
      if (result === "accepted") markInstalled();
      else if (result === "manual") showSteps("android", btn);
    });
  }
}
