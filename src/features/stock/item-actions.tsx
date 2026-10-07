import { Eye, Pencil, Trash2 } from "lucide-preact";
import { useRef, useState } from "preact/hooks";
import { BLOB, initialOf } from "../item/labels";
import { describeError } from "../session/session";
import { BTN_BASE } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import type { StockRow } from "./rows";
import { metaOf, stockOf } from "./stock-card";

export interface ItemActionsProps {
  row: StockRow;
  onEdit: () => void;
  onDelete: () => Promise<void>;
  onView: () => void;
  onCancel: () => void;
}

const TILE =
  "flex min-h-[76px] flex-col items-center justify-center gap-[6px] rounded-[28px] " +
  "font-bold text-[13px]";

// Primario em bloco do markup (54 px, 16 px): sem BTN_BASE, cujo min-h-11 e
// text-[14px] disputariam com estes na ordem do CSS.
const VIEW =
  "mt-[10px] inline-flex min-h-[54px] w-full items-center justify-center gap-1.5 rounded-pill " +
  "bg-accent px-5 font-heading text-[16px] text-bg leading-tight hover:bg-accent-600 active:bg-accent-700";

/** Conteudo do action sheet do Estoque (markup 2b, linhas 255 a 273). */
export function ItemActions({ row, onEdit, onDelete, onView, onCancel }: ItemActionsProps) {
  const { item, status } = row;
  const tone = BLOB[status.primary];
  const [error, setError] = useState<string | null>(null);
  // Trava por ref e nao estado: dois toques no mesmo render leriam o mesmo
  // estado velho. Sem `disabled`: o botao desabilitado perderia o foco para o body.
  const deleting = useRef(false);

  async function remove() {
    if (deleting.current) return;
    deleting.current = true;
    setError(null);
    try {
      await onDelete();
    } catch (cause) {
      // O sheet fica aberto com o motivo; a pessoa tenta de novo ou cancela.
      setError(describeError(cause));
    } finally {
      deleting.current = false;
    }
  }

  return (
    <>
      <div class="flex items-center gap-3 rounded-pill bg-surface py-[10px] pr-4 pl-[10px]">
        <span
          aria-hidden="true"
          class={`grid size-12 flex-none place-items-center rounded-full font-heading text-[20px] ${tone.fill} ${tone.ink}`}
        >
          {initialOf(item.name)}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-bold text-[15px]">{item.name}</p>
          <p class="text-[12px] text-neutral-700">{metaOf(row)}</p>
        </div>
        <span class="whitespace-nowrap font-heading text-[18px]">{stockOf(row)}</span>
      </div>
      <div class="mt-[14px] grid grid-cols-2 gap-[10px]">
        <button type="button" onClick={onEdit} class={`${TILE} bg-accent-2-200 text-accent-2-900`}>
          <Pencil size={22} strokeWidth={2.75} aria-hidden="true" />
          Editar
        </button>
        <button type="button" onClick={remove} class={`${TILE} bg-accent-200 text-accent-900`}>
          <Trash2 size={22} strokeWidth={2.75} aria-hidden="true" />
          Deletar
        </button>
      </div>
      {error !== null && <ErrorText class="mt-[10px]">{error}</ErrorText>}
      <button type="button" onClick={onView} class={VIEW}>
        <Eye size={20} strokeWidth={2.75} aria-hidden="true" />
        Visualizar item
      </button>
      <button
        type="button"
        onClick={onCancel}
        class={`${BTN_BASE} mt-1 w-full px-2 text-neutral-800 hover:bg-text/[0.07] active:bg-text/[0.14]`}
      >
        Cancelar
      </button>
    </>
  );
}
