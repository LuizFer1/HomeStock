import { ChevronLeft, Pencil, Trash2 } from "lucide-preact";
import type { JSX } from "preact";
import { useEffect, useId, useRef, useState } from "preact/hooks";
import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import { describeError, type Session } from "../session/session";
import { Button } from "../ui/button";
import { IconButton } from "../ui/icon-button";
import { TextField } from "../ui/text-field";
import { checkName } from "./names";
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
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [armed, setArmed] = useState(false);
  // Ref e nao estado: dois toques no mesmo render leem o mesmo `busy` velho.
  const working = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const row = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);
  const wasArmed = useRef(false);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  // Lapis vira campo e volta: sem isso o foco se perde com o botao que sumiu.
  useEffect(() => {
    if (editing) row.current?.querySelector("input")?.focus();
    else if (wasEditing.current)
      row.current?.querySelector<HTMLElement>("[data-rename] button")?.focus();
    wasEditing.current = editing;
  }, [editing]);

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
    setDraft(name);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (working.current) return;
    // Nada mudou: fechar sem gravar evita uma escrita (e um HLC novo) a toa.
    if (draft.trim() === name) {
      cancel();
      return;
    }
    const problem = checkName(draft, siblings, id);
    if (problem !== null) {
      setError(problem);
      return;
    }
    working.current = true;
    setBusy(true);
    setError(null);
    try {
      await onRename(draft, id);
      setEditing(false);
    } catch (cause) {
      setError(describeError(cause));
      row.current?.querySelector("input")?.focus();
    } finally {
      working.current = false;
      setBusy(false);
    }
  }

  async function remove() {
    if (working.current) return;
    if (count > 0 && !armed) {
      setArmed(true);
      timer.current = setTimeout(() => {
        timer.current = null;
        setArmed(false);
      }, CONFIRM_MS);
      return;
    }
    disarm();
    working.current = true;
    setBusy(true);
    try {
      await onRemove(id);
      onRemoved();
    } catch (cause) {
      setError(describeError(cause));
    } finally {
      working.current = false;
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

  return (
    <div ref={row} class="flex flex-col py-2">
      {editing ? (
        <div class="flex items-center gap-2">
          <label for={inputId} class="sr-only">
            {`Nome de ${name}`}
          </label>
          <TextField
            id={inputId}
            label={`Nome de ${name}`}
            value={draft}
            class="min-w-0 flex-1"
            onInput={(event) => setDraft(event.currentTarget.value)}
            onKeyDown={onKeyDown}
          />
          <Button
            class="min-h-12"
            aria-label={`Salvar ${name}`}
            disabled={busy}
            onClick={() => void save()}
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
                disabled={busy}
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
      {error !== null ? (
        <p role="alert" class="mt-1 text-[12px] font-semibold text-accent-700">
          {error}
        </p>
      ) : null}
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
    <section aria-labelledby={headingId}>
      <h2
        id={headingId}
        class="mt-5 mb-2 ml-1.5 font-body text-[12px] font-semibold leading-normal tracking-normal text-accent-700"
      >
        {copy.title}
      </h2>
      <div class="rounded-[28px] bg-neutral-100 px-4 py-1">
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
              label={copy.newLabel}
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
          {error !== null ? (
            <p role="alert" class="text-[12px] font-semibold text-accent-700">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </section>
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
