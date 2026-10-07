import { BLOB, initialOf } from "../item/labels";
import { useLongPress } from "../ui/long-press";
import type { StockRow } from "./rows";

export interface StockCardProps {
  row: StockRow;
  /** id da dica "Segure um item para acoes". */
  hintId: string;
  onOpen: () => void;
  onMenu: () => void;
}

const CARD =
  "flex w-full items-center gap-3 rounded-[24px] bg-surface pt-3 pr-4 pb-3 pl-3 text-left " +
  "select-none touch-pan-y [-webkit-touch-callout:none] " +
  "transition-[transform,box-shadow] duration-[180ms] ease-[ease]";

/** Linha "{tamanho} · {nota}"; sem tamanho, so a nota. */
export function metaOf(row: StockRow): string {
  return row.item.size === "" ? row.note : `${row.item.size} · ${row.note}`;
}

/** "{max(0,q)} {unidade}". */
export function stockOf(row: StockRow): string {
  return `${row.qty} ${row.item.unit}`;
}

/**
 * Card do Estoque (markup 2b, linhas 228 a 237). Toque abre o Detalhe; segurar,
 * clique direito ou a tecla de menu abrem as acoes.
 */
export function StockCard({ row, hintId, onOpen, onMenu }: StockCardProps) {
  const press = useLongPress(onMenu);
  const { item, status, level } = row;
  const tone = BLOB[status.primary];
  return (
    <button
      type="button"
      data-item-id={item.id}
      // Os spans colados viram "Café em grãos1 pct" no leitor de tela; com
      // virgulas cada parte e lida separada, o nome do item primeiro.
      aria-label={`${item.name}, ${stockOf(row)}, ${metaOf(row)}`}
      aria-describedby={hintId}
      class={`${CARD} ${press.pressing ? "scale-[0.96] shadow-md" : ""}`}
      {...press.handlers}
      onClick={(event) => {
        if (!press.consumeClick(event)) onOpen();
      }}
    >
      <span
        aria-hidden="true"
        class={`grid size-11 flex-none place-items-center rounded-full font-heading text-[18px] ${tone.fill} ${tone.ink}`}
      >
        {initialOf(item.name)}
      </span>
      <span class="block min-w-0 flex-1">
        <span class="flex items-baseline justify-between gap-2">
          <span class="truncate font-semibold text-[14px]">{item.name}</span>
          <span class="whitespace-nowrap font-heading text-[16px]">{stockOf(row)}</span>
        </span>
        <span
          aria-hidden="true"
          class="mt-1.5 block h-2 overflow-hidden rounded-pill bg-neutral-100"
        >
          <span
            class={`block h-full rounded-pill ${status.primary === "ok" ? "bg-accent-2-500" : "bg-accent"}`}
            style={{ width: `${level}%` }}
          />
        </span>
        <span class="mt-1 block text-[11px] text-neutral-700">{metaOf(row)}</span>
      </span>
    </button>
  );
}
