import { bindDialog } from "./dialog";
import { pixPayload } from "./pix";

export interface CoffeeDeps {
  pix: { key: string; name: string; city: string };
  /** Media query do QR: (hover:hover) and (pointer:fine) and (min-width:720px). */
  wantsQr: () => boolean;
  loadQr: () => Promise<{ qrSvg(payload: string): string }>;
  clipboard: { writeText(text: string): Promise<void> } | undefined;
  setTimeout: (fn: () => void, ms: number) => number;
  clearTimeout: (id: number) => void;
}

const CUPS: Record<number, string> = {
  5: "Seu café mantém",
  10: "Seus 2 cafés mantêm",
  20: "Seus 4 cafés mantêm",
};

const COPY_RESET_MS = 1800;

/** Liga [data-coffee-open] ao dialogo #cafe-dialogo. */
export function bindCoffee(doc: Document, deps: CoffeeDeps): void {
  const dialog = doc.getElementById("cafe-dialogo") as HTMLDialogElement | null;
  if (!dialog) return;
  const modal = bindDialog(dialog);
  const $ = <T extends HTMLElement>(sel: string) => dialog.querySelector<T>(sel);

  const ask = $("[data-coffee-view='ask']");
  const thanks = $("[data-coffee-view='thanks']");
  const priceTag = $("[data-coffee-price]");
  const donate = $("[data-coffee-donate]");
  const qrBlock = $("[data-coffee-qr]");
  const qrImg = $<HTMLImageElement>("[data-coffee-qr-img]");
  const copyBtn = $("[data-coffee-copy]");
  const copyLabel = $("[data-coffee-copy-label]");
  const keyLabel = $("[data-coffee-key]");
  const live = $("[data-coffee-live]");
  const thanksTitle = $("[data-coffee-thanks-title]");
  const thanksText = $("[data-coffee-thanks-text]");
  const radios = [...dialog.querySelectorAll<HTMLInputElement>('input[name="cafe-valor"]')];

  // A chave vem so de pix-config; o HTML nao a repete.
  if (keyLabel) keyLabel.textContent = deps.pix.key;

  const amount = () => Number(radios.find((r) => r.checked)?.value ?? 5);
  const price = (v: number) => `R$ ${v},00`;

  // Cache por valor: cada QR e gerado uma vez. `qrDead` marca falha do import().
  const cache = new Map<number, string>();
  let qrDead = false;

  const showQr = async () => {
    if (!qrImg || !qrBlock || qrDead || !deps.wantsQr()) return;
    const v = amount();
    try {
      let src = cache.get(v);
      if (!src) {
        const { qrSvg } = await deps.loadQr();
        src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrSvg(pixPayload({ ...deps.pix, amount: v })))}`;
        cache.set(v, src);
      }
      // O valor pode ter mudado durante o await: so aplica se ainda e o atual.
      if (v === amount()) qrImg.src = src;
    } catch {
      qrDead = true;
      qrBlock.hidden = true;
    }
  };

  const render = () => {
    const v = amount();
    if (priceTag) priceTag.textContent = `Pix · ${price(v)}`;
    if (donate) donate.textContent = `Doar ${price(v)}`;
    qrImg?.setAttribute("alt", `QR code Pix de ${price(v)}`);
    void showQr();
  };

  for (const r of radios) r.addEventListener("change", render);

  let copyTimer: number | undefined;
  const flashCopy = (ok: boolean, label: string, message: string) => {
    if (copyLabel) {
      copyLabel.textContent = label;
      copyLabel.classList.toggle("is-ok", ok);
    }
    if (live) live.textContent = message;
    if (copyTimer !== undefined) deps.clearTimeout(copyTimer);
    copyTimer = deps.setTimeout(() => {
      if (copyLabel) {
        copyLabel.textContent = "Copiar";
        copyLabel.classList.remove("is-ok");
      }
      copyTimer = undefined;
    }, COPY_RESET_MS);
  };

  copyBtn?.addEventListener("click", async () => {
    const fail = () =>
      flashCopy(false, "Copie à mão", `Não deu para copiar. A chave é ${deps.pix.key}`);
    if (!deps.clipboard) return fail();
    try {
      await deps.clipboard.writeText(deps.pix.key);
      flashCopy(true, "Copiado", "Chave Pix copiada");
    } catch {
      fail();
    }
  });

  donate?.addEventListener("click", () => {
    if (thanksText)
      thanksText.textContent = `${CUPS[amount()] ?? CUPS[5]} o HomeStock grátis para todas as casas.`;
    if (ask) ask.hidden = true;
    if (thanks) thanks.hidden = false;
    thanksTitle?.focus();
  });

  for (const btn of doc.querySelectorAll<HTMLElement>("[data-coffee-open]")) {
    btn.addEventListener("click", () => {
      if (ask) ask.hidden = false;
      if (thanks) thanks.hidden = true;
      render();
      modal.open(btn);
    });
  }
}
