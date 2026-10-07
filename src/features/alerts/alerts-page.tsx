import { ChevronLeft } from "lucide-preact";
import type { JSX } from "preact";
import { useId, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import type { Alert, AlertGroup } from "../../domain/projections/alerts";
import { liveMarkOf } from "../../domain/projections/shopping";
import { describeError } from "../session/session";
import { IconButton } from "../ui/icon-button";
import { AlertCard } from "./alert-card";
import { buildAlerts } from "./build";
import { alertAction, alertMeta, alertTitle, GROUP_LABEL, pendingLabel } from "./labels";

export interface AlertsPageProps {
  ctx: AppContext;
}

const GROUPS: readonly AlertGroup[] = ["today", "week", "older"];

/** Proximo quadro, com queda para setTimeout onde nao ha rAF (igual ao do Estoque). */
function nextFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

/** Item que a acao "Ver item" abre: o do alerta, ou a unica entrada da atividade. */
function itemIdOf(alert: Alert): Ulid | null {
  if (alert.kind === "activity") return alert.entries[0]?.id ?? null;
  return alert.item.id;
}

/** Tela empilhada `alerts` (markup 2f, linhas 427 a 471). */
export function AlertsPage({ ctx }: AlertsPageProps): JSX.Element {
  const { session, router, items, shopping, alerts, toast } = ctx;
  const data = session.data.value;
  const prefs = session.prefs.value;
  const localId = session.localMemberId.value;
  const today = ctx.today();

  const list = useMemo(
    () => buildAlerts(data, prefs, localId, today),
    [data, prefs, localId, today],
  );

  const main = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const mounted = useRef(true);
  // Trava por cartao: dois toques no mesmo cartao usariam duas unidades.
  const locks = useRef(new Set<string>());
  const [busy, setBusy] = useState<readonly string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const todayId = useId();
  const weekId = useId();
  const olderId = useId();
  const titleIds = { today: todayId, week: weekId, older: olderId };

  function focusCard(key: string | null) {
    const card =
      key === null ? null : main.current?.querySelector<HTMLElement>(`[data-alert-key="${key}"]`);
    (card ?? heading.current)?.focus();
  }

  useLayoutEffect(() => {
    mounted.current = true;
    const back = alerts.returnFocus.peek();
    if (back !== null) {
      focusCard(back);
      alerts.returnFocus.value = null;
    }
    return () => {
      mounted.current = false;
    };
    // Montagem: o sinal e lido uma vez so.
  }, []);

  // O cartao so redesenha com o snapshot novo, e o botao do toast some ao fechar.
  function refocus(key: string) {
    nextFrame(() => {
      if (mounted.current) focusCard(key);
    });
  }

  async function run(alert: Alert) {
    const action = alertAction(alert);
    const { key, resolveKeys } = alert;
    // Antes de qualquer await: o segundo toque do mesmo render ve a trava.
    if (locks.current.has(key)) return;
    locks.current.add(key);
    setBusy((b) => [...b, key]);
    setErrors((e) => {
      const { [key]: _gone, ...rest } = e;
      return rest;
    });
    try {
      if (action.kind === "use" && alert.kind === "exp") {
        const { name, unit, id } = alert.item;
        const movement = await items.step(id, -1);
        // Se o resolve falhar, o uso fica e o alerta continua pendente (erro no cartao).
        const written = await alerts.resolve(resolveKeys);
        toast.show(`Usou 1 ${unit} de ${name}`, {
          label: "Desfazer",
          run: async () => {
            await items.undo(movement.id, movement.clearedMarkId);
            // So o que ESTE toque gravou: nunca a lista original.
            await alerts.reopen(written);
            refocus(key);
          },
        });
      } else if (action.kind === "list" && (alert.kind === "out" || alert.kind === "low")) {
        const { item } = alert;
        const d = session.data.value;
        const hadMark = liveMarkOf(item, d.movements, d.listMarks) !== undefined;
        await shopping.pin(item.id);
        const written = await alerts.resolve(resolveKeys);
        toast.show(`${item.name} entrou na lista`, {
          label: "Desfazer",
          run: async () => {
            await shopping.undoPin(item.id, hadMark);
            await alerts.reopen(written);
            refocus(key);
          },
        });
      } else if (action.kind === "view") {
        const id = itemIdOf(alert);
        await alerts.resolve(resolveKeys);
        if (id !== null && mounted.current) {
          alerts.returnFocus.value = key;
          router.push({ kind: "item", id });
        }
        return;
      } else {
        const written = await alerts.resolve(resolveKeys);
        toast.show("Alerta resolvido", {
          label: "Desfazer",
          run: async () => {
            await alerts.reopen(written);
            refocus(key);
          },
        });
      }
      refocus(key);
    } catch (cause) {
      if (mounted.current) setErrors((e) => ({ ...e, [key]: describeError(cause) }));
    } finally {
      locks.current.delete(key);
      if (mounted.current) setBusy((b) => b.filter((k) => k !== key));
    }
  }

  const allOff = !prefs.alertLow && !prefs.alertExpiring && !prefs.alertActivity;
  const { pending } = list;

  return (
    <main ref={main} class="no-scrollbar min-h-dvh bg-bg px-[22px] pt-11 pb-[110px]">
      <div class="flex items-center gap-3">
        <IconButton label="Voltar" onClick={router.back}>
          <ChevronLeft size={20} strokeWidth={2.75} />
        </IconButton>
        <h1 ref={heading} tabIndex={-1} class="text-[36px]">
          Alertas
        </h1>
        <span
          class={`ml-auto inline-flex items-center rounded-[12px] px-[10px] py-[3px] font-semibold text-[11px] tracking-[0.02em] ${
            pending > 0 ? "bg-accent-100 text-accent-800" : "bg-accent-2-100 text-accent-2-800"
          }`}
        >
          {pendingLabel(pending)}
        </span>
      </div>

      {list.total === 0 && (
        <p class="mt-4 rounded-[24px] bg-surface p-4">
          <span class="block font-semibold text-[14px]">
            {allOff ? "Os alertas estão desligados nos Ajustes." : "Nenhum alerta por aqui."}
          </span>
          {!allOff && (
            <span class="block text-[12px] text-neutral-700">
              Itens acabando, perto de vencer e o que a casa fez aparecem aqui.
            </span>
          )}
        </p>
      )}

      {GROUPS.map((group) => {
        const alertsIn = list[group];
        if (alertsIn.length === 0) return null;
        return (
          <section key={group} aria-labelledby={titleIds[group]}>
            <h2
              id={titleIds[group]}
              class={`${group === "today" ? "mt-4" : "mt-[18px]"} mb-2 font-body font-semibold text-[12px] text-neutral-700 leading-normal`}
            >
              {GROUP_LABEL[group]}
            </h2>
            <ul class="flex flex-col gap-[10px]">
              {alertsIn.map((alert) => (
                <AlertCard
                  key={alert.key}
                  alert={alert}
                  title={alertTitle(alert, data.members)}
                  meta={alertMeta(alert, {
                    members: data.members,
                    locations: data.locations,
                    localId,
                    today,
                  })}
                  action={alert.resolved ? null : alertAction(alert)}
                  actor={
                    alert.kind === "activity"
                      ? data.members.find((m) => m.id === alert.actorId && isAlive(m))
                      : undefined
                  }
                  busy={busy.includes(alert.key)}
                  error={errors[alert.key] ?? null}
                  onAction={() => run(alert)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
