import { ChevronLeft, Minus, Plus, ShoppingCart } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { isPhotoDataUrl } from "../../domain/model/member";
import { consumptionOf } from "../../domain/projections/consumption";
import { listStatusOf, liveMarkOf } from "../../domain/projections/shopping";
import { quantities, statusOf } from "../../domain/projections/stock";
import { lastPriceOf } from "../../domain/projections/value";
import { describeError } from "../session/session";
import { UnknownScreen } from "../shell/unknown-screen";
import { BTN_BASE, Button } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import {
  barHeights,
  barLabel,
  consumptionAria,
  consumptionLegend,
  expiryChip,
  formatMoney,
  minimumChip,
  runsOutChip,
  stepperStatus,
} from "./labels";

export interface ItemDetailPageProps {
  ctx: AppContext;
  id: Ulid;
}

// Botoes do hero: fundo `bg` e borda transparente sobre a foto (markup 2c).
// Hover opaco (neutral) e nao translucido: sobre a foto, um fundo /7% deixaria a imagem vazar.
const HERO_BTN =
  "border border-transparent bg-bg text-text hover:bg-neutral-100 active:bg-neutral-200";
const STEP =
  "grid size-14 shrink-0 place-items-center rounded-full disabled:cursor-not-allowed disabled:opacity-45";

/** Proximo quadro, com queda para setTimeout onde nao ha rAF. */
function nextFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

function Chip(props: { label: string; value: string; accent?: boolean }) {
  const { label, value, accent = false } = props;
  return (
    <div
      data-chip
      class={`min-w-0 flex-1 rounded-[20px] p-[10px] ${accent ? "bg-accent-100" : "bg-neutral-100"}`}
    >
      <div class={`text-[11px] ${accent ? "text-accent-800" : "text-neutral-700"}`}>{label}</div>
      <div class={`whitespace-nowrap font-semibold text-[13px] ${accent ? "text-accent-900" : ""}`}>
        {value}
      </div>
    </div>
  );
}

/** Detalhe do item (markup 2c, linhas 277 a 330). */
export function ItemDetailPage({ ctx, id }: ItemDetailPageProps): JSX.Element | null {
  const { session, router, items, toast, shopping } = ctx;
  const data = session.data.value;
  const expiringDays = session.prefs.value.expiringDays;

  const heading = useRef<HTMLHeadingElement>(null);
  const minusBtn = useRef<HTMLButtonElement>(null);
  const plusBtn = useRef<HTMLButtonElement>(null);
  // Soma dos toques ainda gravando: o numero e o limite do − ja contam com eles.
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  // So o resultado do ultimo toque mexe no erro: um velho nao cobre o novo.
  const ticket = useRef(0);
  // Se o − desabilitou no 0 depois do toque, o foco iria ao body.
  const pressedUse = useRef(false);
  // CTA da lista: trava de envio unico, contêiner (para o foco) e erro proprio.
  const listBusy = useRef(false);
  const mounted = useRef(true);
  const cta = useRef<HTMLDivElement>(null);
  const [listError, setListError] = useState<string | null>(null);

  const item = data.items.find((i) => i.id === id && isAlive(i));
  const q = item === undefined ? 0 : (quantities(data.movements).get(id) ?? 0);
  // Entre gravar e o fim do toque, o snapshot novo ja tem o movimento e o
  // pendente ainda o conta: a soma dobra por um instante. Um uso em dobro nao
  // pode mostrar negativo.
  const shown = Math.max(0, Math.max(0, q) + pending);

  useEffect(() => {
    heading.current?.focus();
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    const pressed = pressedUse.current;
    pressedUse.current = false;
    const from = minusBtn.current;
    if (!pressed || from === null || !from.disabled) return;
    const active = document.activeElement;
    if (active === from || active === null || active === document.body) plusBtn.current?.focus();
  }, [shown]);

  // Soma do snapshot (q), nao o `shown`: o pendente do stepper ainda nao mudou a lista.
  const listStatus =
    item === undefined
      ? "off"
      : listStatusOf(
          item,
          Math.max(0, q),
          liveMarkOf(item, data.movements, data.listMarks),
          session.prefs.value.autoList,
        );
  const ctaKind = listStatus === "auto" ? "pill" : "button";
  const prevCtaKind = useRef(ctaKind);
  useEffect(() => {
    const before = prevCtaKind.current;
    prevCtaKind.current = ctaKind;
    if (before === ctaKind) return;
    // Botao e pilula sao elementos diferentes: se o foco estava no que saiu, vai ao novo.
    const active = document.activeElement;
    const lost = active === null || active === document.body || !active.isConnected;
    if (lost) cta.current?.querySelector<HTMLElement>("button, p")?.focus();
  }, [ctaKind]);

  // Apagado em outro lugar (outra aba, sync): nada a mostrar, volta.
  if (item === undefined) return <UnknownScreen onBack={router.back} />;

  const category = data.categories.find((c) => c.id === item.categoryId && isAlive(c));
  const location =
    item.locationId === null
      ? undefined
      : data.locations.find((l) => l.id === item.locationId && isAlive(l));
  const tag = [category?.name ?? "Sem categoria", location?.name].filter(Boolean).join(" · ");
  const meta = [item.size, item.ean === null ? "" : `EAN ${item.ean}`].filter(Boolean).join(" · ");

  const status = statusOf(item, shown, ctx.today(), expiringDays);
  const { daysPerUnit, average } = consumptionOf(id, data.movements);
  const heights = barHeights(daysPerUnit);
  const price = lastPriceOf(id, data.prices);
  const unit = item.unit;

  // O botao do toast some ao fechar; o foco volta ao titulo se ficou perdido.
  function refocusHeading() {
    nextFrame(() => {
      const active = document.activeElement;
      const lost = active === null || active === document.body || !active.isConnected;
      if (lost && heading.current?.isConnected) heading.current.focus();
    });
  }

  async function toggleList() {
    if (item === undefined || listBusy.current) return;
    listBusy.current = true;
    setListError(null);
    const { name } = item;
    try {
      if (listStatus === "pinned") {
        await shopping.unpin(id);
        toast.show(`${name} saiu da lista`, {
          label: "Desfazer",
          run: async () => {
            await shopping.restorePin(id);
            refocusHeading();
          },
        });
      } else {
        await shopping.pin(id);
        toast.show(`${name} entrou na lista`, {
          label: "Desfazer",
          run: async () => {
            await shopping.unpin(id);
            refocusHeading();
          },
        });
      }
    } catch (cause) {
      if (mounted.current) setListError(describeError(cause));
    } finally {
      listBusy.current = false;
    }
  }

  async function step(direction: 1 | -1) {
    // Cada toque conta (sem trava de duplo envio); so nao deixa passar de 0.
    if (direction < 0 && shown <= 0) return;
    if (direction < 0) pressedUse.current = true;
    ticket.current += 1;
    const mine = ticket.current;
    setPending((p) => p + direction);
    try {
      const movement = await items.step(id, direction);
      if (mine === ticket.current) setError(null);
      toast.show(direction < 0 ? `Usou 1 ${unit}` : `Guardou 1 ${unit}`, {
        label: "Desfazer",
        run: async () => {
          await items.undo(movement.id);
          // O botao do toast some ao fechar; o foco volta ao titulo, se a
          // pessoa ainda esta no Detalhe e nao foi para outro lugar.
          nextFrame(() => {
            const active = document.activeElement;
            const lost = active === null || active === document.body || !active.isConnected;
            if (lost && heading.current?.isConnected) heading.current.focus();
          });
        },
      });
    } catch (cause) {
      if (mine === ticket.current) setError(describeError(cause));
    } finally {
      setPending((p) => p - direction);
    }
  }

  return (
    <main class="min-h-dvh bg-bg">
      <div class="relative h-[300px] bg-accent">
        {isPhotoDataUrl(item.photo) && (
          // alt vazio: o nome esta no H2 logo abaixo.
          <img src={item.photo} alt="" class="washed absolute inset-0 size-full object-cover" />
        )}
        <div class="absolute inset-x-[22px] top-[50px] z-[2] flex justify-between">
          <button
            type="button"
            aria-label="Voltar"
            onClick={router.back}
            class={`flex size-11 shrink-0 items-center justify-center rounded-pill ${HERO_BTN}`}
          >
            <ChevronLeft size={20} strokeWidth={2.75} />
          </button>
          <button
            type="button"
            onClick={() => router.push({ kind: "item-edit", id })}
            class={`${BTN_BASE} px-5 ${HERO_BTN}`}
          >
            Editar
          </button>
        </div>
      </div>

      <div class="relative z-[2] -mt-8 rounded-t-[32px] bg-bg px-[22px] pt-[18px] pb-6">
        <div class="flex flex-col items-center text-center">
          <span class="inline-flex items-center rounded-pill bg-accent-2-100 px-[10px] py-[3px] text-[11px] text-accent-2-800 tracking-[0.02em]">
            {tag}
          </span>
          <h2 ref={heading} tabIndex={-1} class="mt-2 text-[30px]">
            {item.name}
          </h2>
          {meta !== "" && <div class="text-[12px] text-neutral-700">{meta}</div>}
        </div>

        {/* fieldset da o papel group (como o CountStepper). */}
        <fieldset
          aria-label="Quantidade"
          class="mx-0 mt-4 mb-0 flex min-w-0 items-center justify-between border-0 rounded-pill bg-surface p-2"
        >
          <button
            type="button"
            aria-label="Usar um"
            ref={minusBtn}
            disabled={shown <= 0}
            onClick={() => step(-1)}
            class={`${STEP} bg-bg text-text hover:bg-neutral-100 active:bg-neutral-200`}
          >
            <Minus size={22} strokeWidth={2.75} />
          </button>
          <div class="text-center">
            <div class="font-heading text-[40px] leading-none">{shown}</div>
            <div class="font-semibold text-[12px] text-neutral-700">
              {stepperStatus(status.primary)}
            </div>
          </div>
          <button
            type="button"
            aria-label="Adicionar um"
            ref={plusBtn}
            onClick={() => step(1)}
            class={`${STEP} bg-accent text-bg hover:bg-accent-600 active:bg-accent-700`}
          >
            <Plus size={22} strokeWidth={2.75} />
          </button>
        </fieldset>
        {error !== null && <ErrorText class="mt-2 text-center">{error}</ErrorText>}

        <div class="mt-3 flex gap-2">
          <Chip label="Mínimo" value={minimumChip(item)} />
          <Chip label="Validade" value={expiryChip(item.expiresAt, ctx.today(), expiringDays)} />
          <Chip label="Acaba em" value={runsOutChip(shown, average)} accent />
        </div>

        <section class="mt-[14px] rounded-[28px] bg-surface p-4">
          <div class="flex items-baseline justify-between gap-2">
            <h3 class="text-[17px] leading-[1.2]">Consumo</h3>
            <span class="text-[12px] text-neutral-700">{consumptionLegend(unit, average)}</span>
          </div>
          {daysPerUnit.length > 0 ? (
            <div
              role="img"
              aria-label={consumptionAria(daysPerUnit)}
              class="mt-[10px] flex h-20 items-end gap-2"
            >
              {daysPerUnit.map((days, index) => (
                <div
                  // A lista so cresce pelo fim e corta pelo comeco; a posicao basta.
                  key={index}
                  class="flex h-full flex-1 flex-col items-center justify-end gap-1"
                >
                  <div
                    class={`w-full rounded-pill ${index === daysPerUnit.length - 1 ? "bg-accent" : "bg-accent-2-400"}`}
                    style={{ height: `${heights[index]}%` }}
                  />
                  <span aria-hidden="true" class="font-semibold text-[10px] text-neutral-700">
                    {barLabel(days)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p class="mt-2 text-[12px] text-neutral-700">
              Toque em − quando usar uma unidade. Com dois usos o app calcula o ritmo.
            </p>
          )}
        </section>

        {price !== null && (
          <div class="mt-[18px] flex items-baseline justify-between">
            <h4 class="text-[20px]">Último preço</h4>
            <span class="font-semibold text-[13px]">{formatMoney(price)}</span>
          </div>
        )}

        <div ref={cta} class="mt-4">
          {listStatus === "auto" ? (
            <p
              tabIndex={-1}
              class="flex min-h-[52px] items-center justify-center gap-1.5 rounded-pill bg-accent-2-100 font-semibold text-[14px] text-accent-2-800"
            >
              <ShoppingCart size={18} strokeWidth={2.75} aria-hidden="true" />
              Na lista de compras · abaixo do mínimo
            </p>
          ) : (
            // Mesmo elemento nos dois estados: o foco fica nele ao trocar o rotulo.
            <Button
              block
              class="min-h-[52px] text-[16px]"
              variant={listStatus === "pinned" ? "secondary" : "primary"}
              onClick={toggleList}
            >
              {listStatus === "pinned"
                ? "Tirar da lista de compras"
                : "Adicionar à lista de compras"}
            </Button>
          )}
          {listError !== null && <ErrorText class="mt-2 text-center">{listError}</ErrorText>}
        </div>
      </div>
    </main>
  );
}
