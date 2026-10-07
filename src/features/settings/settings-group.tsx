import type { ComponentChildren, JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import { describeError } from "../session/session";
import { Button } from "../ui/button";
import { TextField } from "../ui/text-field";

/** Kicker 12/600 accent-700 (margem 20/0/8/6) e bloco neutral-100 raio 28, padding 4/16. */
export function Group({ label, children }: { label: string; children: ComponentChildren }) {
  return (
    <section>
      <h2 class="mt-5 mb-2 ml-1.5 font-body text-[12px] font-semibold leading-normal tracking-normal text-accent-700">
        {label}
      </h2>
      <div class="rounded-[28px] bg-neutral-100 px-4 py-1">{children}</div>
    </section>
  );
}

const ROW_BASE = "flex w-full items-center gap-3 text-left";

/**
 * Linha min-h 52 (ou o `minHeight` do handoff, 56 em Moradores). Com `onClick`
 * vira botao de largura total.
 */
export function Row({
  label,
  value,
  trailing,
  onClick,
  tall = false,
}: {
  label: string;
  value?: ComponentChildren;
  trailing?: ComponentChildren;
  onClick?: () => void;
  tall?: boolean;
}) {
  const inner = (
    <>
      <span class="flex-1 text-[14px] font-semibold">{label}</span>
      {value !== undefined ? <span class="text-[13px] text-neutral-700">{value}</span> : null}
      {trailing}
    </>
  );
  const cls = `${ROW_BASE} ${tall ? "min-h-14" : "min-h-[52px]"}`;
  if (onClick) {
    return (
      <button type="button" class={cls} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div class={cls}>{inner}</div>;
}

/**
 * Texto editavel no lugar. Enter salva, Esc cancela; falha de `onSave` fica em
 * role="alert" com o campo aberto.
 */
export function InlineTextRow({
  label,
  value,
  fallback,
  maxLength,
  onSave,
}: {
  label: string;
  value: string;
  fallback: string;
  maxLength: number;
  onSave: (value: string) => Promise<void>;
}) {
  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Ref e nao estado: dois Enter no mesmo render leem o mesmo `busy` velho.
  const saving = useRef(false);
  // TextField nao repassa `ref`: acha-se o input pelo conteiner.
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const wasEditing = useRef(false);

  // A tela troca o botao pelo campo (e vice-versa): sem isso o foco se perde.
  useEffect(() => {
    if (editing) field.current?.querySelector("input")?.focus();
    else if (wasEditing.current) trigger.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  function open() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(null);
    try {
      await onSave(draft);
      setEditing(false);
    } catch (cause) {
      setError(describeError(cause));
      // O botao Salvar estava com o foco e ficou desabilitado durante a gravacao.
      field.current?.querySelector("input")?.focus();
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }

  function onKeyDown(event: JSX.TargetedKeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void save();
    } else if (event.key === "Escape") {
      event.preventDefault();
      cancel();
    }
  }

  if (!editing) {
    return (
      <button type="button" ref={trigger} class={`${ROW_BASE} min-h-[52px]`} onClick={open}>
        <span class="flex-1 text-[14px] font-semibold">{label}</span>
        <span class="min-w-0 truncate text-[13px] text-neutral-700">
          {value === "" ? fallback : value}
        </span>
      </button>
    );
  }

  return (
    <div class="flex flex-col gap-2 py-2">
      <label for={inputId} class="text-[14px] font-semibold">
        {label}
      </label>
      <div ref={field} class="flex items-center gap-2">
        <TextField
          id={inputId}
          label={label}
          value={draft}
          maxLength={maxLength}
          class="min-w-0 flex-1"
          onInput={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={onKeyDown}
        />
        <Button
          class="min-h-12"
          aria-label={`Salvar ${label}`}
          disabled={busy}
          onClick={() => void save()}
        >
          Salvar
        </Button>
      </div>
      {error !== null ? (
        <p role="alert" class="text-[12px] font-semibold text-accent-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
