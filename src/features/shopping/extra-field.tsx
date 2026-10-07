import { Plus } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import { describeError } from "../session/session";
import { ErrorText } from "../ui/error-text";
import { TextField } from "../ui/text-field";

export interface ExtraFieldProps {
  ctx: AppContext;
}

/** "Pedir algo para a casa": campo pilula + botao "Adicionar pedido" (sem markup; spec). */
export function ExtraField({ ctx }: ExtraFieldProps): JSX.Element {
  const id = useId();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const mounted = useRef(true);
  // TextField nao repassa ref: o campo se acha pelo conteiner.
  const box = useRef<HTMLDivElement>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  async function submit(event: Event) {
    event.preventDefault();
    if (busy.current) return;
    busy.current = true;
    // Limpa antes: o mesmo erro de novo remonta o alerta e o leitor de tela o le outra vez.
    setError(null);
    try {
      await ctx.shopping.addExtra(text);
      if (!mounted.current) return;
      setText("");
      setError(null);
    } catch (cause) {
      if (mounted.current) setError(describeError(cause));
    } finally {
      // O campo fica na tela: a trava reabre; o foco volta a ele (o botao pode ter sido o toque).
      busy.current = false;
      if (mounted.current) box.current?.querySelector("input")?.focus();
    }
  }

  return (
    <>
      <form class="mt-2 flex gap-2" onSubmit={submit}>
        <label class="sr-only" htmlFor={id}>
          Novo pedido da casa
        </label>
        <div ref={box} class="min-w-0 flex-1">
          <TextField
            dense
            id={id}
            value={text}
            onInput={(event) => setText(event.currentTarget.value)}
            placeholder="Pedir algo para a casa"
            maxLength={60}
            enterKeyHint="done"
            autoComplete="off"
          />
        </div>
        <button
          type="submit"
          aria-label="Adicionar pedido"
          class="grid size-11 shrink-0 place-items-center rounded-pill bg-accent text-bg hover:bg-accent-600 active:bg-accent-700"
        >
          <Plus size={20} strokeWidth={2.75} />
        </button>
      </form>
      {error !== null && <ErrorText class="mt-2">{error}</ErrorText>}
    </>
  );
}
