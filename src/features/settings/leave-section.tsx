import { useEffect, useId, useRef, useState } from "preact/hooks";
import { describeError } from "../session/session";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import { TextField } from "../ui/text-field";

export interface LeaveSectionProps {
  /** Resolve com o reload ja pedido; rejeita se o banco nao apagou. */
  onLeave: () => Promise<void>;
}

export const CONFIRMATION = "APAGAR";

export function LeaveSection({ onLeave }: LeaveSectionProps) {
  const inputId = useId();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Ref e nao estado: dois toques no mesmo render leem o mesmo `busy` velho e
  // apagariam duas vezes.
  const leaving = useRef(false);
  const card = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLDivElement>(null);
  const wasOpen = useRef(false);

  // O botao some ao abrir e o card some ao fechar: o foco precisa ir junto.
  useEffect(() => {
    if (open) card.current?.querySelector("input")?.focus();
    else if (wasOpen.current) trigger.current?.querySelector("button")?.focus();
    wasOpen.current = open;
  }, [open]);

  function close() {
    setOpen(false);
    setTyped("");
    setError(null);
  }

  async function leave() {
    if (leaving.current || typed !== CONFIRMATION) return;
    leaving.current = true;
    setBusy(true);
    setError(null);
    try {
      await onLeave();
      // Sucesso recarrega a pagina: o botao fica travado ate la.
    } catch (cause) {
      setError(`Não foi possível apagar os dados: ${describeError(cause)}`);
      leaving.current = false;
      setBusy(false);
      // O botao e o campo ficaram desabilitados durante o apagar e perderam o foco.
      requestAnimationFrame(() => card.current?.querySelector("input")?.focus());
    }
  }

  if (!open) {
    return (
      // Button nao repassa `ref`: acha-se o botao pelo conteiner.
      <div ref={trigger}>
        <Button
          variant="secondary"
          block
          class="mt-[18px] min-h-12 text-accent-700"
          onClick={() => setOpen(true)}
        >
          Sair da casa
        </Button>
      </div>
    );
  }

  return (
    <div ref={card} class="mt-[18px] rounded-[28px] bg-accent-100 p-4">
      <p class="text-[14px] leading-snug">
        Apaga o estoque, o histórico, as categorias, os locais e o seu perfil deste aparelho. Não há
        como desfazer. Exporte o CSV antes se quiser guardar uma cópia.
      </p>
      <label for={inputId} class="mt-3 mb-1.5 block text-[13px] font-semibold">
        Digite {CONFIRMATION} para confirmar
      </label>
      <TextField
        id={inputId}
        value={typed}
        autocomplete="off"
        autocapitalize="characters"
        disabled={busy}
        onInput={(event) => setTyped(event.currentTarget.value)}
      />
      {error !== null ? <ErrorText class="mt-2">{error}</ErrorText> : null}
      <div class="mt-3 flex flex-col gap-1">
        <Button block disabled={typed !== CONFIRMATION || busy} onClick={() => void leave()}>
          Apagar dados deste aparelho
        </Button>
        <Button variant="ghost" block disabled={busy} onClick={close}>
          Cancelar
        </Button>
      </div>
    </div>
  );
}
