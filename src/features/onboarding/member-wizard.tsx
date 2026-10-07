import { Camera, ChevronLeft, Image as ImageIcon } from "lucide-preact";
import type { JSX } from "preact";
import { useState } from "preact/hooks";
import { MAX_MEMBER_NAME, type MemberColor, type MemberDraft } from "../../domain/model/member";
import { describeError } from "../session/session";
import { Avatar } from "../ui/avatar";
import { BTN_SECONDARY, Button } from "../ui/button";
import { ColorSwatches } from "../ui/color-swatches";
import { IconButton } from "../ui/icon-button";
import { MEMBER_COLOR_STYLE } from "../ui/member-color";
import { TextField } from "../ui/text-field";

export interface MemberWizardProps {
  mode: "create" | "edit";
  /** Valores atuais no modo edicao. Padrao: nome vazio, terracota, sem foto. */
  initial?: MemberDraft;
  /** Rejeitar mantem o wizard aberto e mostra a mensagem em role="alert". */
  onSubmit: (draft: MemberDraft) => Promise<void>;
  /** Modo edicao: voltar no passo 1. */
  onCancel?: () => void;
  /** Pipeline da foto, injetado: o happy-dom nao tem canvas. */
  processFile: (file: Blob) => Promise<string>;
}

const DEFAULT_DRAFT: MemberDraft = { name: "", color: "terracota", photo: null };
const PROGRESS = ["1 de 3", "2 de 3", "3 de 3", "Pronto"];
const CTA_CLASS = "min-h-14 text-[17px]";

export function MemberWizard({
  mode,
  initial,
  onSubmit,
  onCancel,
  processFile,
}: MemberWizardProps) {
  const start = initial ?? DEFAULT_DRAFT;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(start.name);
  const [color, setColor] = useState<MemberColor>(start.color);
  const [photo, setPhoto] = useState<string | null>(start.photo);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const edit = mode === "edit";
  const nameEmpty = name.trim() === "";
  const shown = nameEmpty ? "Você" : name.trim();

  async function submit(nextPhoto: string | null) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await onSubmit({ name: name.trim(), color, photo: nextPhoto });
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    setError(null);
    setStep(step + 1);
  }

  function back() {
    setError(null);
    if (step === 0) onCancel?.();
    else setStep(step - 1);
  }

  async function pick(event: JSX.TargetedEvent<HTMLInputElement, Event>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (file === undefined) return;
    try {
      setPhoto(await processFile(file));
      setError(null);
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      // Sem isso, escolher o mesmo arquivo de novo nao dispara `change`.
      input.value = "";
    }
  }

  function useInitialOnly() {
    setPhoto(null);
    if (edit) void submit(null);
    else advance();
  }

  let ctaLabel = "Continuar";
  let ctaDisabled = false;
  let ctaAction: () => void = advance;
  if (step === 0) {
    ctaDisabled = nameEmpty;
  } else if (step === 2 && edit) {
    ctaLabel = "Salvar";
    ctaDisabled = busy;
    ctaAction = () => void submit(photo);
  } else if (step === 3) {
    ctaLabel = "Entrar no HomeStock";
    ctaDisabled = busy;
    ctaAction = () => void submit(photo);
  }

  return (
    <div class="flex min-h-dvh flex-col bg-bg">
      <div class="flex min-h-[50px] items-center gap-3 px-[22px]">
        {step > 0 || edit ? (
          <IconButton label="Voltar" onClick={back}>
            <ChevronLeft size={22} strokeWidth={2.75} />
          </IconButton>
        ) : (
          <span class="size-11 shrink-0" />
        )}
        <div class="flex flex-1 gap-1.5">
          {[0, 1, 2].map((index) => (
            <span
              key={index}
              class={`h-2 flex-1 rounded-pill ${index <= step ? "bg-accent" : "bg-surface"}`}
            />
          ))}
        </div>
        <span class="w-12 text-right font-semibold text-[12px] text-neutral-700">
          {PROGRESS[step]}
        </span>
      </div>

      <main class="no-scrollbar flex-1 px-[22px] pt-6">
        {step === 0 && (
          <>
            {!edit && (
              <span class="inline-block rounded-pill bg-accent-2-100 px-3 py-1 font-semibold text-[11px] text-accent-2-800">
                Bem-vindo ao HomeStock
              </span>
            )}
            <h1 class="mt-3 text-[36px]">Como podemos te chamar?</h1>
            <p class="mt-2 text-[15px] text-neutral-700">
              Seu nome aparece para quem divide a casa com você.
            </p>
            <TextField
              large
              label="Seu nome"
              placeholder="Seu nome"
              maxLength={MAX_MEMBER_NAME}
              autoFocus
              value={name}
              class="mt-6"
              onInput={(event) => setName(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !nameEmpty) advance();
              }}
            />
            <div class="mt-5 flex items-center gap-3 rounded-pill bg-neutral-100 p-2 pr-4">
              <Avatar name={shown} color={color} photo={photo} size={40} />
              <div class="min-w-0">
                <p class="truncate text-[14px]">
                  <strong>{shown}</strong> adicionou Café em grãos
                </p>
                <p class="text-[11px] text-neutral-700">Prévia de como você aparece</p>
              </div>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <h1 class="text-[36px]">Qual é a sua cor?</h1>
            <p class="mt-2 text-[15px] text-neutral-700">
              Ela marca o que é seu no histórico, na lista e nos alertas.
            </p>
            <div class="mt-6 flex flex-col items-center gap-1 rounded-[32px] bg-surface p-4">
              <Avatar name={shown} color={color} photo={photo} size={96} />
              <p class="font-heading text-[24px]">{shown}</p>
              <p class="font-semibold text-[13px] text-neutral-700">
                {MEMBER_COLOR_STYLE[color].label}
              </p>
            </div>
            <div class="mt-6">
              <ColorSwatches legend="Sua cor" value={color} onChange={setColor} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 class="text-[36px]">Um sorriso pra casa</h1>
            <p class="mt-2 text-[15px] text-neutral-700">
              Opcional. Sem foto, usamos sua inicial na sua cor.
            </p>
            <div class="mt-6 flex flex-col items-center gap-2">
              <div
                class="rounded-pill p-[10px]"
                style={{ background: MEMBER_COLOR_STYLE[color].fill }}
              >
                <Avatar name={shown} color={color} photo={photo} size={170} class="washed" />
              </div>
              <p class="font-heading text-[24px]">{shown}</p>
            </div>
            <div class="mt-6 flex gap-3">
              <label class={`${BTN_SECONDARY} min-h-12 flex-1`}>
                <Camera size={18} strokeWidth={2.75} />
                Câmera
                <input
                  type="file"
                  accept="image/*"
                  capture="user"
                  class="sr-only"
                  onChange={(event) => void pick(event)}
                />
              </label>
              <label class={`${BTN_SECONDARY} min-h-12 flex-1`}>
                <ImageIcon size={18} strokeWidth={2.75} />
                Galeria
                <input
                  type="file"
                  accept="image/*"
                  class="sr-only"
                  onChange={(event) => void pick(event)}
                />
              </label>
            </div>
          </>
        )}

        {step === 3 && (
          <div class="flex flex-col items-center pt-10 text-center">
            <Avatar name={shown} color={color} photo={photo} size={72} class="border-4 border-bg" />
            <h1 class="mt-4 text-[36px]">Tudo pronto, {shown}!</h1>
            <p class="mt-2 text-[15px] text-neutral-700">
              Seu estoque fica guardado neste aparelho e funciona sem internet.
            </p>
          </div>
        )}

        {error !== null && (
          <p role="alert" class="mt-4 font-semibold text-[14px] text-accent-700">
            {error}
          </p>
        )}
      </main>

      <div class="px-[22px] pt-2.5 pb-6">
        <Button block class={CTA_CLASS} disabled={ctaDisabled} onClick={ctaAction}>
          {ctaLabel}
        </Button>
        {step === 2 && (
          <Button
            variant="ghost"
            block
            class="mt-1 min-h-11"
            disabled={busy}
            onClick={useInitialOnly}
          >
            Usar só a inicial
          </Button>
        )}
      </div>
    </div>
  );
}
