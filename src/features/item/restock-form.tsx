import { Check, X } from "lucide-preact";
import type { ComponentChildren, JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Item } from "../../domain/model/item";
import { quantities } from "../../domain/projections/stock";
import { lastPriceOf } from "../../domain/projections/value";
import { describeError } from "../session/session";
import { closeIfStill } from "../shell/route";
import { Button } from "../ui/button";
import { CountStepper } from "../ui/count-stepper";
import { ErrorText } from "../ui/error-text";
import { IconButton } from "../ui/icon-button";
import { TextField } from "../ui/text-field";
import { Field } from "./item-form";
import { formatMoney, saveLabel } from "./labels";
import { PriceField } from "./price-field";

export interface RestockFormProps {
  ctx: AppContext;
  item: Item;
  /** Visor parado do scanner ("Ler outro código"), acima do banner. */
  top: ComponentChildren;
  screenKind: "scan" | "item-new";
}

/** Reposicao de item ja cadastrado (markup 2d, linhas 339 a 378, sem categoria e sem nota fiscal). */
export function RestockForm({ ctx, item, top, screenKind }: RestockFormProps): JSX.Element {
  const { session, router, items, toast } = ctx;
  const data = session.data.value;
  const q = Math.max(0, quantities(data.movements).get(item.id) ?? 0);
  const lastPrice = lastPriceOf(item.id, data.prices);

  const [qty, setQty] = useState(() => Math.min(999, Math.max(1, item.usualQty)));
  const [expiresAt, setExpiresAt] = useState("");
  const [priceText, setPriceText] = useState("");
  const [priceMinor, setPriceMinor] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Conta cada falha: a mesma mensagem duas vezes ainda precisa mover o foco.
  const [failures, setFailures] = useState(0);
  const [busy, setBusy] = useState(false);

  // Ref e nao estado: dois toques no mesmo render leem o mesmo `busy` velho.
  const submitting = useRef(false);
  // "Ler outro código" durante a gravacao troca a reposicao: a tela nao fecha por baixo.
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);
  const expiresId = useId();
  const priceId = useId();

  useEffect(() => {
    // O visor ou o campo de onde veio o codigo deu lugar a reposicao: o foco vai ao titulo.
    heading.current?.focus();
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (failures > 0) errorBox.current?.focus();
  }, [failures]);

  async function submit() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    // Lido antes do await: o voltar do sistema pode desempilhar durante a gravacao.
    const depth = router.stack.value.length;
    try {
      const receipt = await items.restockScan(
        item.id,
        qty,
        priceMinor,
        expiresAt === "" ? null : expiresAt,
      );
      toast.show(`Guardou ${qty} ${item.unit} de ${item.name}`, {
        label: "Desfazer",
        run: () => items.undoRestock(receipt),
      });
      // A tela sai: a trava fica fechada para um toque perdido nao gravar de novo.
      if (mounted.current) closeIfStill(router, depth, screenKind);
    } catch (cause) {
      submitting.current = false;
      if (!mounted.current) return;
      setBusy(false);
      setError(describeError(cause));
      setFailures((n) => n + 1);
    }
  }

  const size = item.size.trim();

  return (
    <main class="min-h-dvh bg-bg px-[22px] pt-11 pb-6">
      <div class="flex items-center justify-between">
        <h1 ref={heading} tabIndex={-1} class="text-[26px]">
          Novo item
        </h1>
        <IconButton label="Fechar" onClick={router.back}>
          <X size={20} strokeWidth={2.75} />
        </IconButton>
      </div>

      {top}

      <div
        role="status"
        class="mt-3 flex items-center gap-[10px] rounded-pill bg-accent-2-200 py-2 pr-4 pl-2"
      >
        <span
          aria-hidden="true"
          class="grid size-9 flex-none place-items-center rounded-full bg-accent-2-700 text-bg"
        >
          <Check size={18} strokeWidth={2.75} />
        </span>
        <div class="min-w-0">
          <p class="font-semibold text-[13px] text-accent-2-900">
            {size === "" ? `Achamos! ${item.name}` : `Achamos! ${item.name} ${size}`}
          </p>
          <p class="text-[11px] text-accent-2-800">Já existe no estoque · vamos somar</p>
        </div>
      </div>

      <div class="mt-4 flex flex-col gap-3">
        <CountStepper
          label="Quantidade"
          hint={`Você tem ${q} ${item.unit}`}
          value={qty}
          min={1}
          onChange={setQty}
        />
        <div class="grid grid-cols-2 gap-[10px]">
          <Field id={expiresId} label="Validade">
            <TextField
              dense
              id={expiresId}
              type="date"
              value={expiresAt}
              onInput={(event) => setExpiresAt(event.currentTarget.value)}
            />
          </Field>
          <Field id={priceId} label="Preço unitário">
            <PriceField
              id={priceId}
              value={priceText}
              // O ultimo preco so sugere: preenchido, gravaria um valor que ninguem conferiu.
              placeholder={lastPrice === null ? "R$ 0,00" : formatMoney(lastPrice)}
              onChange={(text, minor) => {
                setPriceText(text);
                setPriceMinor(minor);
              }}
            />
          </Field>
        </div>
      </div>

      {error !== null && (
        // Alvo do foco: o leitor de tela le a mensagem ao focar (sem alert duplicado).
        <div ref={errorBox} tabIndex={-1} class="mt-4">
          <ErrorText alert={false}>{error}</ErrorText>
        </div>
      )}

      <Button
        block
        class="mt-[14px] min-h-[52px] text-[16px]"
        disabled={busy}
        onClick={() => void submit()}
      >
        {saveLabel(qty, item.unit, priceMinor)}
      </Button>
    </main>
  );
}
