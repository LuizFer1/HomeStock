import { ChevronLeft, Pencil, Trash2 } from "lucide-preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { describeError, type Session } from "../session/session";
import { Button } from "../ui/button";
import { ErrorText } from "../ui/error-text";
import { IconButton } from "../ui/icon-button";
import { TextField } from "../ui/text-field";
import { useInlineEdit } from "../ui/use-inline-edit";
import { checkName } from "./names";
import { Group } from "./settings-group";
import type { SettingsStore } from "./store";

export interface PlacesPageProps {
  session: Session;
  store: SettingsStore;
  onBack: () => void;
}

type Kind = "category" | "location";

const COPY: Record<Kind, { title: string; newLabel: string; addLabel: string }> = {
  category: { title: "Categorias", newLabel: "Nova categoria", addLabel: "Adicionar categoria" },
  location: { title: "Locais", newLabel: "Novo local", addLabel: "Adicionar local" },
};

/** Quanto tempo o "Remover?" fica armado antes de voltar a lixeira. */
const CONFIRM_MS = 4000;

function countLabel(n: number): string {
  if (n === 0) return "Nenhum item";
  return n === 1 ? "1 item" : `${n} itens`;
}

interface PlaceRowProps {
  id: Ulid;
  name: string;
  count: number;
  siblings: ReadonlyArray<{ id: string; name: string }>;
  onRename: (name: string, id: Ulid) => Promise<void>;
  onRemove: (id: Ulid) => Promise<void>;
  /** Depois de remover a linha some e leva o foco: a lista decide para onde ele vai. */
  onRemoved: () => void;
}

function PlaceRow({ id, name, count, siblings, onRename, onRemove, onRemoved }: PlaceRowProps) {
  const inputId = useId();
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const wasArmed = useRef(false);
  const edit = useInlineEdit({
    value: name,
    onSave: (draft) => onRename(draft, id),
    validate: (draft) => checkName(draft, siblings, id),
    scope: row,
    returnFocus: () => row.current?.querySelector<HTMLElement>("[data-rename] button"),
  });
  const { editing } = edit;

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // Lixeira vira "Remover?" e volta: o botao que sumiu levava o foco para o body.
  useEffect(() => {
    const box = row.current;
    if (armed) {
      box?.querySelector<HTMLElement>("[data-remove] button")?.focus();
    } else if (wasArmed.current && !editing) {
      const active = document.activeElement;
      if (active === document.body || box?.contains(active)) {
        box?.querySelector<HTMLElement>("[data-remove] button")?.focus();
      }
    }
    wasArmed.current = armed;
  }, [armed, editing]);

  function disarm() {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    setArmed(false);
  }

  function open() {
    disarm();
    edit.open();
  }

  async function remove() {
    if (count > 0 && !armed) {
      setArmed(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setArmed(false);
      }, CONFIRM_MS);
      return;
    }
    disarm();
    await edit.guarded(async () => {
      await onRemove(id);
      onRemoved();
    });
  }

  return (
    <div ref={row} class="flex flex-col py-2">
      {editing ? (
        <div class="flex items-center gap-2">
          <label for={inputId} class="sr-only">
            {`Nome de ${name}`}
          </label>
          <TextField
            id={inputId}
            value={edit.draft}
            class="min-w-0 flex-1"
            onInput={(event) => edit.setDraft(event.currentTarget.value)}
            onKeyDown={edit.onKeyDown}
          />
          <Button
            class="min-h-12"
            aria-label={`Salvar ${name}`}
            disabled={edit.busy}
            onClick={() => void edit.save()}
          >
            Salvar
          </Button>
        </div>
      ) : (
        <div class="flex min-h-11 items-center gap-2">
          <div class="min-w-0 flex-1">
            <div class="truncate text-[14px] font-semibold">{name}</div>
            <div class="text-[12px] text-neutral-700">{countLabel(count)}</div>
          </div>
          <span data-rename class="contents">
            <IconButton label={`Renomear ${name}`} onClick={open}>
              <Pencil size={18} strokeWidth={2.75} />
            </IconButton>
          </span>
          <span data-remove class="contents">
            {armed ? (
              <Button
                variant="ghost"
                aria-label={`Confirmar remoção de ${name}`}
                disabled={edit.busy}
                onClick={() => void remove()}
              >
                Remover?
              </Button>
            ) : (
              <IconButton label={`Remover ${name}`} onClick={() => void remove()}>
                <Trash2 size={18} strokeWidth={2.75} />
              </IconButton>
            )}
          </span>
        </div>
      )}
      {edit.error !== null ? <ErrorText class="mt-1">{edit.error}</ErrorText> : null}
    </div>
  );
}

interface PlaceListProps {
  kind: Kind;
  rows: ReadonlyArray<{ id: Ulid; name: string; count: number }>;
  onUpsert: (name: string, id?: Ulid) => Promise<void>;
  onRemove: (id: Ulid) => Promise<void>;
}

function PlaceList({ kind, rows, onUpsert, onRemove }: PlaceListProps) {
  const copy = COPY[kind];
  const headingId = useId();
  const fieldId = useId();
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const adding = useRef(false);
  const addBox = useRef<HTMLDivElement>(null);

  async function add() {
    if (adding.current) return;
    const problem = checkName(draft, rows);
    if (problem !== null) {
      setError(problem);
      return;
    }
    adding.current = true;
    setBusy(true);
    setError(null);
    try {
      await onUpsert(draft);
      setDraft("");
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      adding.current = false;
      setBusy(false);
    }
  }

  return (
    <Group label={copy.title} id={headingId}>
      {rows.map((row) => (
        <PlaceRow
          key={row.id}
          id={row.id}
          name={row.name}
          count={row.count}
          siblings={rows}
          onRename={onUpsert}
          onRemove={onRemove}
          onRemoved={() => addBox.current?.querySelector("input")?.focus()}
        />
      ))}
      <div ref={addBox} class="flex flex-col gap-2 py-2">
        <label for={fieldId} class="sr-only">
          {copy.newLabel}
        </label>
        <div class="flex items-center gap-2">
          <TextField
            id={fieldId}
            placeholder={copy.newLabel}
            value={draft}
            class="min-w-0 flex-1"
            onInput={(event) => {
              setDraft(event.currentTarget.value);
              setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void add();
              }
            }}
          />
          <Button
            class="min-h-12"
            aria-label={copy.addLabel}
            disabled={draft.trim() === "" || busy}
            onClick={() => void add()}
          >
            Adicionar
          </Button>
        </div>
        {error !== null ? <ErrorText>{error}</ErrorText> : null}
      </div>
    </Group>
  );
}

function byName<T extends { name: string }>(a: T, b: T): number {
  return a.name.localeCompare(b.name, "pt-BR");
}

export function PlacesPage({ session, store, onBack }: PlacesPageProps) {
  const heading = useRef<HTMLHeadingElement>(null);

  // Ao abrir, o foco vai ao titulo: o botao que abriu a tela sumiu.
  useEffect(() => {
    heading.current?.focus();
  }, []);

  const { items, categories, locations } = session.data.value;
  const alive = items.filter(isAlive);
  const categoryRows = categories
    .filter(isAlive)
    .sort(byName)
    .map((c) => ({
      id: c.id,
      name: c.name,
      count: alive.filter((i) => i.categoryId === c.id).length,
    }));
  const locationRows = locations
    .filter(isAlive)
    .sort(byName)
    .map((l) => ({
      id: l.id,
      name: l.name,
      count: alive.filter((i) => i.locationId === l.id).length,
    }));

  return (
    <main class="no-scrollbar px-[22px] pt-11 pb-7">
      <div class="flex items-center gap-3">
        <IconButton label="Voltar" onClick={onBack}>
          <ChevronLeft size={20} strokeWidth={2.75} />
        </IconButton>
        <h1 ref={heading} tabIndex={-1} class="text-[32px]">
          Categorias e locais
        </h1>
      </div>
      <PlaceList
        kind="category"
        rows={categoryRows}
        onUpsert={store.upsertCategory}
        onRemove={store.removeCategory}
      />
      <PlaceList
        kind="location"
        rows={locationRows}
        onUpsert={store.upsertLocation}
        onRemove={store.removeLocation}
      />
    </main>
  );
}
