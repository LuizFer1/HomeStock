import type { ComponentChildren } from "preact";
import { useId, useRef } from "preact/hooks";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import { TextField } from "../ui/text-field";
import { useInlineEdit } from "../ui/use-inline-edit";

/** Kicker 12/600 accent-700 (margem 20/0/8/6). */
export const GROUP_KICKER =
  "mt-5 mb-2 ml-1.5 font-body text-[12px] font-semibold leading-normal tracking-normal text-accent-700";

/** Bloco neutral-100 raio 28, padding 4/16. */
export const GROUP_BLOCK = "rounded-[28px] bg-neutral-100 px-4 py-1";

/** Kicker e bloco. Com `id` o titulo ganha esse id e a secao vira regiao nomeada por ele. */
export function Group({
  label,
  id,
  children,
}: {
  label: string;
  id?: string;
  children: ComponentChildren;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} class={GROUP_KICKER}>
        {label}
      </h2>
      <div class={GROUP_BLOCK}>{children}</div>
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
 * role="alert" com o campo aberto. Valor igual ao gravado fecha sem escrever.
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
  // TextField nao repassa `ref`: acha-se o input pelo conteiner.
  const field = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const edit = useInlineEdit({
    value,
    onSave,
    scope: field,
    returnFocus: () => trigger.current,
  });

  if (!edit.editing) {
    return (
      <button type="button" ref={trigger} class={`${ROW_BASE} min-h-[52px]`} onClick={edit.open}>
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
          value={edit.draft}
          maxLength={maxLength}
          class="min-w-0 flex-1"
          onInput={(event) => edit.setDraft(event.currentTarget.value)}
          onKeyDown={edit.onKeyDown}
        />
        <Button
          class="min-h-12"
          aria-label={`Salvar ${label}`}
          disabled={edit.busy}
          onClick={() => void edit.save()}
        >
          Salvar
        </Button>
      </div>
      {edit.error !== null ? <ErrorText>{edit.error}</ErrorText> : null}
    </div>
  );
}
