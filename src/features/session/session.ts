import { batch, computed, type ReadonlySignal, signal } from "@preact/signals";
import type { HomeStockDb } from "../../data/db";
import { openRepository, type Repository, type Snapshot } from "../../data/repository";
import type { RandomChunk, Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import type { Member } from "../../domain/model/member";
import { type PrefValues, prefsFrom } from "../../domain/model/prefs";

export type SessionStatus = "loading" | "ready" | "error";

export interface SessionDeps {
  db: HomeStockDb;
  now: () => number;
  randomChunk: RandomChunk;
  /** 'YYYY-MM-DD' local, repassado ao repositorio. */
  today: () => string;
}

/**
 * Espelho em memoria do banco, compartilhado por todas as telas. Toda escrita
 * passa por `run`, que grava e so entao republica o `snapshot()` inteiro.
 */
export interface Session {
  status: ReadonlySignal<SessionStatus>;
  /** So a falha de abertura do banco. Erro de comando volta para quem chamou `run`. */
  error: ReadonlySignal<string | null>;
  data: ReadonlySignal<Snapshot>;
  localMemberId: ReadonlySignal<Ulid | null>;
  /** Linha viva do morador local, ou null. */
  localMember: ReadonlySignal<Member | null>;
  prefs: ReadonlySignal<PrefValues>;
  init: () => Promise<void>;
  run: <T>(command: (repo: Repository) => Promise<T>) => Promise<T>;
  reload: () => Promise<void>;
}

export const EMPTY_SNAPSHOT: Snapshot = {
  items: [],
  categories: [],
  locations: [],
  members: [],
  prefs: [],
  listExtras: [],
  listMarks: [],
  movements: [],
  prices: [],
};

/** Mensagem legivel de uma falha qualquer, para as telas. */
export function describeError(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

export function createSession(deps: SessionDeps): Session {
  const status = signal<SessionStatus>("loading");
  const error = signal<string | null>(null);
  const data = signal<Snapshot>(EMPTY_SNAPSHOT);
  const localMemberId = signal<Ulid | null>(null);
  let repo: Repository | null = null;
  // Numero da leitura mais nova ja pedida e da mais nova ja publicada.
  let requested = 0;
  let published = 0;

  async function init(): Promise<void> {
    try {
      const opened = await openRepository({
        db: deps.db,
        now: deps.now,
        randomChunk: deps.randomChunk,
        today: deps.today,
        // `peek`: o repositorio le o autor na hora do comando, sem assinar o signal.
        currentMemberId: () => localMemberId.peek(),
      });
      // O id antes do snapshot: assim o snapshot e no minimo tao novo quanto o
      // id, e um onboarding concluido em outra aba entre as duas leituras nao
      // publica um id cuja linha falta em `members`.
      const memberId = await opened.localMemberId();
      const snapshot = await opened.snapshot();
      repo = opened;
      // Uma publicacao so: `ready` com estado vazio faria a tela piscar o
      // onboarding antes de o disco responder.
      batch(() => {
        data.value = snapshot;
        localMemberId.value = memberId;
        status.value = "ready";
      });
    } catch (cause) {
      // Nao relanca: quem chama e o `main.tsx`, e a tela de erro e quem avisa.
      batch(() => {
        status.value = "error";
        error.value = describeError(cause);
      });
    }
  }

  async function reload(): Promise<void> {
    const current = repo;
    if (current === null) return;
    requested += 1;
    const ticket = requested;
    // Mesma ordem do `init`: id primeiro, snapshot depois.
    const memberId = await current.localMemberId();
    const snapshot = await current.snapshot();
    // Duas leituras em voo podem terminar fora de ordem; a mais velha nao pode
    // cobrir a mais nova.
    if (ticket <= published) return;
    published = ticket;
    batch(() => {
      data.value = snapshot;
      localMemberId.value = memberId;
    });
  }

  async function run<T>(command: (repo: Repository) => Promise<T>): Promise<T> {
    if (repo === null) throw new Error("Sessao nao inicializada");
    // Grava antes de publicar: se o banco recusar, a tela nao muda.
    const result = await command(repo);
    // Se o comando gravou e o reload falhar, `run` rejeita com a escrita salva;
    // o proximo reload a publica.
    await reload();
    return result;
  }

  return {
    status,
    error,
    data,
    localMemberId,
    localMember: computed(() => {
      const id = localMemberId.value;
      if (id === null) return null;
      return data.value.members.find((member) => member.id === id && isAlive(member)) ?? null;
    }),
    prefs: computed(() => prefsFrom(data.value.prefs)),
    init,
    run,
    reload,
  };
}
