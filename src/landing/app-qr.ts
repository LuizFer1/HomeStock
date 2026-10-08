import type { Platform } from "./platform";

export interface AppQrDeps {
  platform: Platform;
  /** matchMedia("(display-mode: standalone)").matches */
  standalone: boolean;
  /** URL absoluta do app (ver appUrl). */
  url: string;
  loadQr: () => Promise<{ qrSvg(payload: string): string }>;
}

/** URL absoluta do app a partir da base da pagina (producao ou preview local). */
export function appUrl(base: string): string {
  return new URL("app/", base).href;
}

/**
 * Cartoes [data-app-qr]: so o computador (fora do PWA instalado) gera o QR,
 * entao o celular nunca baixa o chunk da lib. O CSS esconde os cartoes nos
 * outros casos; aqui so se decide se vale carregar.
 */
export async function bindAppQr(doc: Document, deps: AppQrDeps): Promise<void> {
  if (deps.platform !== "desktop" || deps.standalone) return;
  const cards = [...doc.querySelectorAll<HTMLElement>("[data-app-qr]")];
  if (cards.length === 0) return;

  // Mostra a URL sem o protocolo: e o que a pessoa confere a olho.
  const label = deps.url.replace(/^https?:\/\//, "");
  for (const el of doc.querySelectorAll("[data-app-qr-url]")) el.textContent = label;

  try {
    const { qrSvg } = await deps.loadQr();
    const src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(deps.url))}`;
    for (const img of doc.querySelectorAll<HTMLImageElement>("[data-app-qr-img]")) {
      img.src = src;
      img.hidden = false;
    }
  } catch {
    // Sem a lib nao ha QR: esconde o cartao em vez de deixar um quadro vazio.
    for (const card of cards) card.hidden = true;
  }
}
