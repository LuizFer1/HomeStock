import { Search } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import type { AppContext } from "../../app-context";
import type { Ulid } from "../../domain/ids/ulid";
import { Button } from "../ui/button";
import { Sheet } from "../ui/sheet";
import { TextField } from "../ui/text-field";
import { ItemActions } from "./item-actions";
import { buildFilters, buildStockRows, validFilter, visibleRows } from "./rows";
import { StockCard } from "./stock-card";

export interface StockPageProps {
  ctx: AppContext;
}

/** Proximo quadro, com queda para setTimeout onde nao ha rAF. */
function nextFrame(run: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(run);
  else setTimeout(run, 0);
}

/**
 * Foca o card devolvido pelo Desfazer. Depois do proximo quadro: o card so
 * volta ao DOM quando a lista redesenha com o snapshot novo. Escondido pela
 * busca ou pelo filtro, o foco vai ao titulo (o botao Desfazer some junto com
 * o toast). Se a pessoa ja saiu do Estoque, nada acontece.
 */
function focusCard(id: Ulid, fallback: HTMLElement | null): void {
  nextFrame(() => {
    const restored = document.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
    if (restored !== null) restored.focus();
    else if (fallback?.isConnected) fallback.focus();
  });
}

const CHIP =
  "flex-none snap-start whitespace-nowrap min-h-10 px-4 rounded-pill font-semibold text-[13px]";

/** Aba Estoque (markup 2b, linhas 215 a 241). */
export function StockPage({ ctx }: StockPageProps): JSX.Element {
  const { session, router, items, stock, toast } = ctx;
  const data = session.data.value;
  const today = ctx.today();
  const expiringDays = session.prefs.value.expiringDays;
  // Digitar na busca redesenha a pagina; as linhas so mudam com os dados.
  const rows = useMemo(
    () => buildStockRows(data, today, expiringDays),
    [data, today, expiringDays],
  );
  const filter = validFilter(stock.filter.value, data);
  const filters = buildFilters(rows, data, filter);
  const query = stock.query.value;
  const visible = visibleRows(rows, filter, query);

  const hintId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  const [menuId, setMenuId] = useState<Ulid | null>(null);
  // Procurado a cada render: item apagado em outra aba fecha o sheet sozinho.
  const menuRow = menuId === null ? undefined : rows.find((row) => row.item.id === menuId);
  // O card some ao deletar; o foco vai ao titulo, mas so depois de o dialog
  // fechar: com ele modal aberto, o resto da pagina e inerte e nao aceita foco.
  const focusHeading = useRef(false);

  useLayoutEffect(() => {
    // Volta a posicao de antes do Detalhe, uma vez so: zerada aqui, a troca
    // de aba seguinte nao pula para uma posicao velha.
    const saved = stock.scrollY.peek();
    if (saved !== 0) {
      stock.scrollY.value = 0;
      // O happy-dom nao implementa scrollTo.
      try {
        window.scrollTo(0, saved);
      } catch {}
    }
    // Depois da rolagem: o foco volta ao card que abriu a tela (sem rolar de
    // novo), ou ao titulo se ele sumiu. Uma vez so, como a rolagem.
    const opened = stock.openedId.peek();
    if (opened === null) return;
    stock.openedId.value = null;
    const target =
      document.querySelector<HTMLElement>(`[data-item-id="${opened}"]`) ?? heading.current;
    target?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (menuId !== null && menuRow === undefined) setMenuId(null);
    // Os efeitos do Sheet (filho) rodam antes deste: o `close` ja aconteceu.
    if (focusHeading.current && menuRow === undefined) {
      focusHeading.current = false;
      heading.current?.focus();
    }
  });

  function push(kind: "item" | "item-edit", id: Ulid) {
    stock.scrollY.value = window.scrollY;
    stock.openedId.value = id;
    router.push({ kind, id });
  }

  async function remove(id: Ulid, name: string) {
    // Marcado antes do await: o snapshot novo pode redesenhar a lista (e fechar
    // o sheet) antes de esta funcao continuar, e o efeito precisa ver a marca.
    focusHeading.current = true;
    try {
      await items.remove(id);
    } catch (cause) {
      focusHeading.current = false;
      throw cause;
    }
    setMenuId(null);
    toast.show(`${name} removido`, {
      label: "Desfazer",
      run: async () => {
        await items.restore(id);
        focusCard(id, heading.current);
      },
    });
  }

  return (
    <main class="px-[22px] pt-11 pb-[110px]">
      <div class="flex items-baseline justify-between gap-2">
        <h1 ref={heading} tabIndex={-1} class="text-[36px]">
          Estoque
        </h1>
        <span id={hintId} class="font-semibold text-[11px] text-neutral-700">
          Segure um item para ações
          {/* Quem usa teclado nao segura: o caminho dele e a tecla de menu. */}
          <span class="sr-only"> ou use a tecla de menu</span>
        </span>
      </div>

      <div class="mt-3">
        <TextField
          type="search"
          label="Buscar item ou código"
          placeholder="Buscar item ou código"
          icon={<Search size={18} strokeWidth={2.75} />}
          value={query}
          onInput={(event) => {
            stock.query.value = event.currentTarget.value;
          }}
        />
      </div>

      {/* fieldset so pelo papel de grupo; min-w-0 porque o min-content padrao dele
          alargaria a pagina com o carrossel inteiro. */}
      <fieldset class="m-0 min-w-0 border-0 p-0">
        <legend class="sr-only">Filtros</legend>
        <div class="no-scrollbar -mx-[22px] mt-3 flex snap-x snap-mandatory scroll-px-[22px] gap-2 overflow-x-auto overscroll-x-contain px-[22px]">
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={active}
                onClick={() => {
                  stock.filter.value = f.key;
                }}
                class={`${CHIP} ${active ? "bg-text text-bg" : "bg-surface text-text"}`}
              >
                {f.label} <span class="opacity-70">{f.count}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      {rows.length === 0 ? (
        <div class="mt-4 rounded-[24px] bg-surface p-4">
          <p class="font-semibold text-[14px]">Seu estoque está vazio.</p>
          <p class="mt-1 text-[12px] text-neutral-700">
            Cadastre o primeiro item para acompanhar o que tem em casa.
          </p>
          <Button class="mt-3" onClick={() => router.push({ kind: "item-new" })}>
            Adicionar item
          </Button>
        </div>
      ) : visible.length === 0 ? (
        <p class="mt-6 text-center text-[13px] text-neutral-700">Nenhum item encontrado.</p>
      ) : (
        <div class="mt-4 flex flex-col gap-[10px]">
          {visible.map((row) => (
            <StockCard
              key={row.item.id}
              row={row}
              hintId={hintId}
              onOpen={() => push("item", row.item.id)}
              onMenu={() => setMenuId(row.item.id)}
            />
          ))}
        </div>
      )}

      <Sheet
        open={menuRow !== undefined}
        label={menuRow === undefined ? "Ações do item" : `Ações de ${menuRow.item.name}`}
        onClose={() => setMenuId(null)}
      >
        {menuRow !== undefined && (
          <ItemActions
            row={menuRow}
            onEdit={() => {
              setMenuId(null);
              push("item-edit", menuRow.item.id);
            }}
            onDelete={() => remove(menuRow.item.id, menuRow.item.name)}
            onView={() => {
              setMenuId(null);
              push("item", menuRow.item.id);
            }}
            onCancel={() => setMenuId(null)}
          />
        )}
      </Sheet>
    </main>
  );
}
