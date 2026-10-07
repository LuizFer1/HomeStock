import { Bell } from "lucide-preact";
import type { JSX } from "preact";
import { useLayoutEffect, useMemo, useRef } from "preact/hooks";
import type { AppContext } from "../../app-context";
import { homeSummary } from "../../domain/projections/home";
import { shoppingList } from "../../domain/projections/shopping";
import { buildAlerts } from "../alerts/build";
import { bellLabel } from "../alerts/labels";
import { BLOB, formatMoney } from "../item/labels";
import { householdAvatars } from "../shopping/labels";
import { buildStockRows } from "../stock/rows";
import { Avatar, initialOf } from "../ui/avatar";
import { greeting, healthPercent, healthSubtitle, itemsLine } from "./labels";

export interface HomePageProps {
  ctx: AppContext;
}

/** Circunferencia do anel de saude (raio 38 do markup). */
const C = 2 * Math.PI * 38;

const COUNTER = "flex aspect-square flex-1 flex-col items-center justify-center rounded-full";

/** Aba Inicio (markup 2a, linhas 159 a 203). */
export function HomePage({ ctx }: HomePageProps): JSX.Element {
  const { session, router, stock, home } = ctx;
  const data = session.data.value;
  const prefs = session.prefs.value;
  const localId = session.localMemberId.value;
  const me = session.localMember.value;
  const today = ctx.today();

  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const summary = useMemo(
    () =>
      homeSummary({
        items: data.items,
        movements: data.movements,
        prices: data.prices,
        today,
        expDays: prefs.expiringDays,
      }),
    [data, today, prefs.expiringDays],
  );
  const rows = useMemo(
    () =>
      buildStockRows(data, today, prefs.expiringDays)
        .filter((r) => r.status.primary === "out" || r.status.primary === "low")
        .slice(0, 4),
    [data, today, prefs.expiringDays],
  );
  const pending = useMemo(
    () => buildAlerts(data, prefs, localId, today).pending,
    [data, prefs, localId, today],
  );
  const onList = useMemo(
    () =>
      shoppingList({
        items: data.items,
        movements: data.movements,
        prices: data.prices,
        marks: data.listMarks,
        extras: data.listExtras,
        autoList: prefs.autoList,
      }).total,
    [data, prefs.autoList],
  );
  const avatars = householdAvatars(data.members, localId);

  // A aba desmonta ao empilhar uma tela: ao voltar, o controle que a abriu recebe o foco.
  useLayoutEffect(() => {
    const back = home.returnFocus.peek();
    if (back === null) return;
    home.returnFocus.value = null;
    const target = main.current?.querySelector<HTMLElement>(`[data-return-focus="${back}"]`);
    (target ?? heading.current)?.focus();
    // Montagem: o sinal e lido uma vez so.
  }, []);

  function openStock() {
    stock.filter.value = "all";
    stock.query.value = "";
    router.selectTab("stock");
  }

  function openExpiring() {
    // Sem o alerta de vencimento a tela Alertas nao mostraria o que o numero conta.
    if (!prefs.alertExpiring) return openStock();
    home.returnFocus.value = "counter-expiring";
    router.push({ kind: "alerts" });
  }

  const ring = summary.health;

  return (
    <main ref={main} class="no-scrollbar px-[22px] pt-11 pb-[110px]">
      <div class="flex items-center justify-between">
        <button
          type="button"
          aria-label="Ajustes"
          data-return-focus="settings"
          class="flex rounded-pill"
          onClick={() => {
            home.returnFocus.value = "settings";
            router.push({ kind: "settings" });
          }}
        >
          {/* Sem a linha do morador (apagada no sync), o botao fica: "Sair da casa" mora nos Ajustes. */}
          {avatars.length === 0 ? (
            <Avatar name="" color="cacau" photo={null} size={40} class="border-3 border-bg" />
          ) : (
            avatars.map((m, i) => (
              <Avatar
                key={m.id}
                name={m.name}
                color={m.color}
                photo={m.photo}
                size={40}
                class={`border-3 border-bg ${i > 0 ? "-ml-3" : ""}`}
              />
            ))
          )}
        </button>
        <button
          type="button"
          data-return-focus="alerts"
          aria-label={bellLabel(pending)}
          onClick={() => {
            home.returnFocus.value = "alerts";
            router.push({ kind: "alerts" });
          }}
          class="relative grid size-11 place-items-center rounded-pill border border-divider text-text hover:bg-text/[0.07] active:bg-text/[0.14]"
        >
          <Bell size={20} strokeWidth={2.75} />
          {pending > 0 && (
            <span
              aria-hidden="true"
              class="absolute top-2 right-[9px] size-[9px] rounded-full border-2 border-bg bg-accent"
            />
          )}
        </button>
      </div>

      <h1 ref={heading} tabIndex={-1} class="mt-[18px] mb-[2px] text-[36px]">
        {greeting(me?.name ?? null)}
      </h1>
      <p class="text-[14px] text-neutral-800">{healthSubtitle(ring)}</p>

      <div class="mt-[18px] flex items-center gap-4 rounded-[32px] bg-accent-2-200 p-[18px]">
        <div
          role="img"
          aria-label={`Saúde do estoque: ${ring === null ? "sem itens" : healthPercent(ring)}`}
          class="relative size-[92px] flex-none"
        >
          <svg width="92" height="92" viewBox="0 0 92 92" aria-hidden="true">
            <circle
              cx="46"
              cy="46"
              r="38"
              fill="none"
              stroke="currentColor"
              stroke-width="10"
              class="text-accent-2-300"
            />
            {ring !== null && ring > 0 && (
              <circle
                cx="46"
                cy="46"
                r="38"
                fill="none"
                stroke="currentColor"
                stroke-width="10"
                stroke-linecap="round"
                stroke-dasharray={`${C * ring} ${C}`}
                transform="rotate(-90 46 46)"
                class="text-accent-2-700"
              />
            )}
          </svg>
          <span
            aria-hidden="true"
            class="absolute inset-0 grid place-items-center font-heading text-[22px] text-accent-2-900"
          >
            {healthPercent(ring)}
          </span>
        </div>
        <div class="min-w-0">
          <p class="font-semibold text-[12px] text-accent-2-800">Valor em estoque</p>
          <p class="whitespace-nowrap font-heading text-[24px] text-accent-2-900 leading-[1.1]">
            {formatMoney(summary.valueMinor)}
          </p>
          <p class="mt-[2px] text-[12px] text-accent-2-800">
            {itemsLine(summary.items, summary.ok)}
          </p>
        </div>
      </div>

      <div class="mt-4 flex gap-3">
        <button
          type="button"
          aria-label={`${summary.runningOut} acabando`}
          onClick={openStock}
          class={`${COUNTER} bg-accent-200 text-accent-900`}
        >
          <span class="font-heading text-[30px] leading-none">{summary.runningOut}</span>
          <span class="font-semibold text-[12px]">acabando</span>
        </button>
        <button
          type="button"
          data-return-focus="counter-expiring"
          aria-label={`${summary.expiring} vencendo`}
          onClick={openExpiring}
          class={`${COUNTER} bg-surface text-text`}
        >
          <span class="font-heading text-[30px] leading-none">{summary.expiring}</span>
          <span class="font-semibold text-[12px]">vencendo</span>
        </button>
        <button
          type="button"
          aria-label={`${onList} na lista`}
          onClick={() => router.selectTab("shopping")}
          class={`${COUNTER} border-2 border-neutral-400 border-dashed text-text`}
        >
          <span class="font-heading text-[30px] leading-none">{onList}</span>
          <span class="font-semibold text-[12px]">na lista</span>
        </button>
      </div>

      <section aria-labelledby="home-running-out">
        <div class="mt-[22px] flex items-baseline justify-between">
          <h2 id="home-running-out" class="text-[20px]">
            Acabando
          </h2>
          <button
            type="button"
            onClick={openStock}
            class="font-semibold text-[13px] text-accent-700"
          >
            Ver estoque
          </button>
        </div>
        {rows.length === 0 ? (
          <p class="mt-[10px] rounded-[24px] bg-surface p-4">
            <span class="block font-semibold text-[14px]">
              {summary.items === 0 ? "Seu estoque está vazio." : "Nada acabando por enquanto."}
            </span>
            <span class="block text-[12px] text-neutral-700">
              {summary.items === 0
                ? "Toque em Escanear para guardar o primeiro item."
                : "Itens abaixo do mínimo aparecem aqui."}
            </span>
          </p>
        ) : (
          <ul class="mt-[10px] flex flex-col gap-2">
            {rows.map((row) => {
              const { item } = row;
              const tone = BLOB[row.status.primary];
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    data-return-focus={`item:${item.id}`}
                    aria-label={`${item.name}, ${row.qty} ${item.unit}, ${row.note}`}
                    onClick={() => {
                      home.returnFocus.value = `item:${item.id}`;
                      router.push({ kind: "item", id: item.id });
                    }}
                    class="flex w-full items-center gap-3 rounded-pill bg-neutral-100 py-[10px] pr-[14px] pl-[10px] text-left"
                  >
                    <span
                      aria-hidden="true"
                      class={`grid size-10 flex-none place-items-center rounded-full font-heading text-[17px] ${tone.fill} ${tone.ink}`}
                    >
                      {initialOf(item.name)}
                    </span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate font-semibold text-[14px]">{item.name}</span>
                      <span class="block text-[12px] text-neutral-700">{row.note}</span>
                    </span>
                    <span class="whitespace-nowrap font-heading text-[18px] text-accent-700">
                      {row.qty} {item.unit}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
