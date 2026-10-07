import type { ComponentChildren, JSX } from "preact";
import { useEffect, useId, useMemo, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Member } from "../../domain/model/member";
import {
  checkedEntries,
  type ShoppingEntry,
  shoppingList,
} from "../../domain/projections/shopping";
import { formatMoney } from "../item/labels";
import { describeError } from "../session/session";
import { Avatar } from "../ui/avatar";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import { Sheet } from "../ui/sheet";
import { AdjustSheet } from "./adjust-sheet";
import { ExtraField } from "./extra-field";
import {
  checkoutMessage,
  entryMeta,
  entryTitle,
  footerLabel,
  householdAvatars,
  progressLabel,
  unpricedLabel,
} from "./labels";
import { ShoppingRow } from "./shopping-row";

export interface ShoppingPageProps {
  ctx: AppContext;
}

interface SectionProps {
  title: string;
  /** Cor do kicker: accent na automatica, accent-2 nos pedidos (markup 399 e 409). */
  tone: string;
  entries: readonly ShoppingEntry[];
  members: readonly Member[];
  onToggle: (entry: ShoppingEntry) => void;
  onAdjust: (entry: ShoppingEntry) => void;
  /** Depois das linhas (o campo de pedido). */
  children?: ComponentChildren;
}

function Section({ title, tone, entries, members, onToggle, onAdjust, children }: SectionProps) {
  const id = useId();
  return (
    <section aria-labelledby={id}>
      <h2
        id={id}
        class={`mt-[18px] mb-2 font-body font-semibold text-[12px] leading-normal ${tone}`}
      >
        {title}
      </h2>
      {entries.length > 0 && (
        <div class="flex flex-col gap-2">
          {entries.map((entry) => (
            <ShoppingRow
              key={entry.key}
              entry={entry}
              meta={entryMeta(entry, members)}
              onToggle={() => onToggle(entry)}
              onAdjust={() => onAdjust(entry)}
            />
          ))}
        </div>
      )}
      {children}
    </section>
  );
}

/** Aba Compras (markup 2e, linhas 383 a 425). */
export function ShoppingPage({ ctx }: ShoppingPageProps): JSX.Element {
  const { session, shopping, toast, update } = ctx;
  const data = session.data.value;
  const { autoList, preferredStore } = session.prefs.value;
  const localId = session.localMemberId.value;
  // Rodape e toast moram a 100 px; com o aviso de versao (tambem fixo) tudo sobe 64 px.
  const raised = update.ready.value;

  const list = useMemo(
    () =>
      shoppingList({
        items: data.items,
        movements: data.movements,
        prices: data.prices,
        marks: data.listMarks,
        extras: data.listExtras,
        autoList,
      }),
    [data, autoList],
  );

  const [toggleError, setToggleError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Conta cada falha: a mesma mensagem duas vezes ainda precisa mover o foco.
  const [failures, setFailures] = useState(0);
  const [busy, setBusy] = useState(false);
  const [adjustingKey, setAdjustingKey] = useState<string | null>(null);
  // Procurada a cada render: linha restocada ou removida por fora fecha o sheet sozinho.
  const adjusting =
    adjustingKey === null
      ? undefined
      : [...list.auto, ...list.house].find((e) => e.key === adjustingKey);
  // So depois de o dialog fechar o resto da pagina aceita foco (enquanto modal e inerte).
  const focusHeading = useRef(false);

  // Ref e nao estado: dois toques no mesmo render leem o mesmo `busy` velho.
  const submitting = useRef(false);
  // So o ultimo toque publica o erro: a falha de um toque velho nao cobre a do novo.
  const toggleTicket = useRef(0);
  // A aba pode trocar durante a gravacao: nada de setState nem foco depois disso.
  const mounted = useRef(true);
  const heading = useRef<HTMLHeadingElement>(null);
  const errorBox = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  useEffect(() => {
    if (adjustingKey !== null && adjusting === undefined) {
      setAdjustingKey(null);
      focusHeading.current = true;
    }
    // Os efeitos do Sheet (filho) rodam antes deste: o `close` ja aconteceu.
    if (focusHeading.current && adjusting === undefined) {
      focusHeading.current = false;
      heading.current?.focus();
    }
  });

  useEffect(() => {
    if (failures > 0) errorBox.current?.focus();
  }, [failures]);

  async function onToggle(entry: ShoppingEntry) {
    toggleTicket.current += 1;
    const ticket = toggleTicket.current;
    try {
      await shopping.toggle(entry);
      if (mounted.current && ticket === toggleTicket.current) setToggleError(null);
    } catch (cause) {
      if (mounted.current && ticket === toggleTicket.current) setToggleError(describeError(cause));
    }
  }

  async function onRepor() {
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    // Lido antes do await: nome, quantidade e unidade das linhas que a pessoa viu marcadas.
    const seen = new Map(checkedEntries(list).map((e) => [e.id, e]));
    try {
      const receipt = await shopping.checkout(list);
      // O toast conta o recibo, nao a tela: linha desmarcada no meio nao entrou no lote.
      const items = receipt.itemIds.flatMap((id) => {
        const e = seen.get(id);
        return e === undefined ? [] : [{ qty: e.qty, unit: e.unit, name: e.name }];
      });
      if (receipt.movementIds.length + receipt.extraIds.length > 0) {
        toast.show(checkoutMessage(items, receipt.extraIds.length), {
          label: "Desfazer",
          run: async () => {
            await shopping.undoCheckout(receipt);
            // O botao do toast some: o foco volta ao titulo e nao ao corpo da pagina.
            if (mounted.current) heading.current?.focus();
          },
        });
      }
      // O Repor desabilita (nada marcado) e as linhas somem: o foco vai ao titulo.
      if (mounted.current) heading.current?.focus();
    } catch (cause) {
      if (mounted.current) {
        setError(describeError(cause));
        setFailures((n) => n + 1);
      }
    } finally {
      // A aba fica: a trava reabre para a proxima compra.
      submitting.current = false;
      if (mounted.current) setBusy(false);
    }
  }

  const avatars = householdAvatars(data.members, localId);
  const pct = list.total === 0 ? 0 : Math.round((list.done / list.total) * 100);

  return (
    <>
      <main class={`no-scrollbar px-[22px] pt-11 ${raised ? "pb-[264px]" : "pb-[200px]"}`}>
        <div class="flex items-center justify-between">
          <h1 ref={heading} tabIndex={-1} class="text-[36px]">
            Compras
          </h1>
          {/* biome-ignore lint/a11y/useSemanticElements: fieldset e para campos de formulario; aqui so agrupa avatares */}
          <div role="group" aria-label="Moradores" class="flex">
            {avatars.map((m, i) => (
              <Avatar
                key={m.id}
                name={m.name}
                color={m.color}
                photo={m.photo}
                size={36}
                class={`border-3 border-bg ${i > 0 ? "-ml-[10px]" : ""}`}
              />
            ))}
          </div>
        </div>

        {list.total > 0 && (
          <div class="mt-[10px] flex items-center gap-[10px]">
            <div
              role="progressbar"
              aria-label="Itens comprados"
              aria-valuemin={0}
              aria-valuemax={list.total}
              aria-valuenow={list.done}
              aria-valuetext={progressLabel(list.done, list.total)}
              class="h-3 flex-1 overflow-hidden rounded-pill bg-surface"
            >
              <div class="h-full rounded-pill bg-accent-2-600" style={{ width: `${pct}%` }} />
            </div>
            <span aria-hidden="true" class="font-semibold text-[12px]">
              {progressLabel(list.done, list.total)}
            </span>
          </div>
        )}

        {toggleError !== null && <ErrorText class="mt-2">{toggleError}</ErrorText>}

        {list.auto.length > 0 && (
          <Section
            title="Gerados pelo estoque"
            tone="text-accent-700"
            entries={list.auto}
            members={data.members}
            onToggle={onToggle}
            onAdjust={(e) => setAdjustingKey(e.key)}
          />
        )}
        <Section
          title="Pedidos da casa"
          tone="text-accent-2-700"
          entries={list.house}
          members={data.members}
          onToggle={onToggle}
          onAdjust={(e) => setAdjustingKey(e.key)}
        >
          <ExtraField ctx={ctx} />
        </Section>

        {list.total === 0 && (
          <div class="mt-4 rounded-[24px] bg-surface p-4">
            <p class="font-semibold text-[14px]">Nada para comprar.</p>
            <p class="text-[12px] text-neutral-700">
              {autoList
                ? "Itens abaixo do mínimo entram aqui sozinhos."
                : "A lista automática está desligada nos Ajustes."}
            </p>
          </div>
        )}

        {error !== null && (
          // Alvo do foco: o leitor de tela le a mensagem ao focar (sem alert duplicado).
          <div ref={errorBox} tabIndex={-1} class="mt-4">
            <ErrorText alert={false}>{error}</ErrorText>
          </div>
        )}
      </main>

      <Sheet
        open={adjusting !== undefined}
        label={adjusting === undefined ? "Ajustar" : `Ajustar ${entryTitle(adjusting)}`}
        onClose={() => setAdjustingKey(null)}
      >
        {adjusting !== undefined && (
          <AdjustSheet
            key={adjusting.key}
            ctx={ctx}
            entry={adjusting}
            onClose={() => setAdjustingKey(null)}
            onGone={() => {
              focusHeading.current = true;
              setAdjustingKey(null);
            }}
          />
        )}
      </Sheet>

      {list.total > 0 && (
        // Flutua sobre a lista acima da tab bar (18 + 68 + 14 px); o `pb` do main deixa a
        // ultima linha rolar para fora de baixo dele.
        <div
          class={`fixed inset-x-[14px] ${raised ? "bottom-[164px]" : "bottom-[100px]"} z-10 mx-auto flex max-w-[452px] items-center gap-3 rounded-[32px] bg-surface py-[14px] pr-[14px] pl-[22px] shadow-md`}
        >
          <div class="min-w-0 flex-1">
            <p class="font-semibold text-[11px] text-neutral-700">{footerLabel(preferredStore)}</p>
            <p class="font-heading text-[24px] leading-[1.1]">{formatMoney(list.remainingMinor)}</p>
            {list.unpriced > 0 && (
              <p class="text-[11px] text-neutral-700">{unpricedLabel(list.unpriced)}</p>
            )}
          </div>
          <Button class="min-h-[52px] px-5" disabled={list.done === 0 || busy} onClick={onRepor}>
            Repor estoque
          </Button>
        </div>
      )}
    </>
  );
}
