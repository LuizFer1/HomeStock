import type { JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { ShoppingEntry } from "../../domain/projections/shopping";
import { Field } from "../item/item-form";
import { formatMoney } from "../item/labels";
import { PriceField } from "../item/price-field";
import { describeError } from "../session/session";
import { Button } from "../ui/button";
import { CountStepper } from "../ui/count-stepper";
import { ErrorText } from "../ui/error-text";
import { entryTitle } from "./labels";

export interface AdjustSheetProps {
  ctx: AppContext;
  entry: ShoppingEntry;
  /** Fecha o sheet (o pai zera a linha aberta). */
  onClose: () => void;
  /** A linha saiu da lista por um botao daqui: o pai fecha e foca o H1. */
  onGone: () => void;
  /** O Desfazer do toast devolveu a linha: o pai foca o titulo (o botao do toast some). */
  onUndone: () => void;
}

/** Conteudo do sheet "Ajustar" (markup 2e nao desenha; valores da spec). */
export function AdjustSheet({
  ctx,
  entry,
  onClose,
  onGone,
  onUndone,
}: AdjustSheetProps): JSX.Element {
  const { shopping, toast, router } = ctx;
  const priceId = useId();
  const [qty, setQty] = useState(entry.qty);
  const [priceText, setPriceText] = useState(
    entry.priceMinor === null ? "" : formatMoney(entry.priceMinor),
  );
  const [priceMinor, setPriceMinor] = useState(entry.priceMinor);
  const [error, setError] = useState<string | null>(null);
  // Conta cada falha: a mesma mensagem duas vezes ainda precisa mover o foco.
  const [failures, setFailures] = useState(0);

  // Ref e nao estado: dois toques no mesmo render leem o mesmo estado velho.
  const busy = useRef(false);
  // O sheet fecha sozinho se a linha some por fora: nada de setState depois do await.
  const mounted = useRef(true);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    if (failures > 0) errorBox.current?.focus();
  }, [failures]);

  // Uma trava so para Salvar, Tirar e Remover. Sucesso deixa a trava fechada (o sheet sai);
  // falha reabre e mostra o erro.
  async function guarded(work: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setError(null);
    try {
      await work();
    } catch (cause) {
      busy.current = false;
      if (mounted.current) {
        setError(describeError(cause));
        setFailures((n) => n + 1);
      }
    }
  }

  function save() {
    return guarded(async () => {
      await shopping.adjust(entry, qty, priceMinor);
      if (mounted.current) onClose();
    });
  }

  function leave(restore: () => Promise<void>, remove: () => Promise<void>) {
    return guarded(async () => {
      await remove();
      toast.show(`${entry.name} saiu da lista`, {
        label: "Desfazer",
        run: async () => {
          await restore();
          // O sheet ja desmontou: quem sabe se a tela ainda esta de pe e o pai.
          onUndone();
        },
      });
      if (mounted.current) onGone();
    });
  }

  const isItem = entry.kind === "item";
  const canUnpin = isItem && entry.pinned && entry.section === "house";

  return (
    <div>
      <h2 class="text-[22px]">{entryTitle(entry)}</h2>
      {isItem && entry.have !== null && (
        <p class="text-[12px] text-neutral-700">{`Você tem ${entry.have} ${entry.unit}`.trim()}</p>
      )}

      <div class="mt-4 flex flex-col gap-3">
        <CountStepper label="Quantidade" min={1} max={999} value={qty} onChange={setQty} />
        <Field id={priceId} label="Preço unitário">
          <PriceField
            id={priceId}
            value={priceText}
            placeholder={
              entry.estimateMinor === null ? "R$ 0,00" : formatMoney(entry.estimateMinor)
            }
            onChange={(text, minor) => {
              setPriceText(text);
              setPriceMinor(minor);
            }}
          />
        </Field>
      </div>

      {error !== null && (
        // Alvo do foco: o leitor de tela le a mensagem ao focar (sem alert duplicado).
        <div ref={errorBox} tabIndex={-1} class="mt-3">
          <ErrorText alert={false}>{error}</ErrorText>
        </div>
      )}

      <Button block class="mt-[14px] min-h-[52px] text-[16px]" onClick={save}>
        Salvar
      </Button>
      {isItem && (
        <Button
          variant="secondary"
          block
          class="mt-2"
          onClick={() => {
            onClose();
            router.push({ kind: "item", id: entry.id });
          }}
        >
          Ver item
        </Button>
      )}
      {canUnpin && (
        <Button
          variant="ghost"
          block
          class="mt-2"
          onClick={() =>
            leave(
              () => shopping.restorePin(entry.id),
              () => shopping.unpin(entry.id),
            )
          }
        >
          Tirar da lista
        </Button>
      )}
      {!isItem && (
        <Button
          variant="ghost"
          block
          class="mt-2"
          onClick={() =>
            leave(
              () => shopping.restoreExtra(entry.id),
              () => shopping.removeExtra(entry.id),
            )
          }
        >
          Remover da lista
        </Button>
      )}
    </div>
  );
}
