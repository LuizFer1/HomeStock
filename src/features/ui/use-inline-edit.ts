import type { JSX, RefObject } from "preact";
import { useEffect, useRef, useState } from "preact/hooks";
import { describeError } from "../session/session";

export interface InlineEditOptions {
  /** Valor gravado hoje; abrir parte dele e fechar sem mudar nao grava. */
  value: string;
  onSave: (draft: string) => Promise<void>;
  /** Erro para mostrar sob o campo, ou null. Roda antes de gravar. */
  validate?: (draft: string) => string | null;
  /** Conteiner que tem o `<input>`: recebe o foco ao abrir e apos falha. */
  scope: RefObject<HTMLElement>;
  /** Elemento que leva o foco quando o campo fecha (o botao que abriu sumiu). */
  returnFocus: () => HTMLElement | null | undefined;
}

/**
 * Edicao em linha: abre, Enter salva, Esc cancela. O guarda e uma ref e nao
 * estado porque dois toques no mesmo render leem o mesmo `busy` velho.
 */
export function useInlineEdit({ value, onSave, validate, scope, returnFocus }: InlineEditOptions) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const working = useRef(false);
  const wasEditing = useRef(false);
  // Sempre a versao do render atual, sem refazer o efeito a cada render.
  const focusBack = useRef(returnFocus);
  focusBack.current = returnFocus;

  // O botao vira campo e volta: sem isso o foco se perde com o que sumiu.
  useEffect(() => {
    if (editing) scope.current?.querySelector("input")?.focus();
    else if (wasEditing.current) focusBack.current()?.focus();
    wasEditing.current = editing;
  }, [editing, scope]);

  function open() {
    setDraft(value);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  /** Uma operacao por vez; falha vira `error` e devolve o foco ao campo. */
  async function guarded(task: () => Promise<void>) {
    if (working.current) return;
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await task();
    } catch (cause) {
      setError(describeError(cause));
      // O botao Salvar tinha o foco e ficou desabilitado durante a gravacao.
      scope.current?.querySelector("input")?.focus();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function save() {
    if (working.current) return;
    // Nada mudou: fechar sem gravar evita uma escrita (e um HLC novo) a toa.
    if (draft.trim() === value.trim()) {
      cancel();
      return;
    }
    const problem = validate?.(draft) ?? null;
    if (problem !== null) {
      setError(problem);
      return;
    }
    await guarded(async () => {
      await onSave(draft);
      setEditing(false);
    });
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

  return {
    editing,
    draft,
    setDraft,
    error,
    busy,
    open,
    cancel,
    save,
    guarded,
    onKeyDown,
  };
}
