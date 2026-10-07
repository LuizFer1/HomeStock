import type { Ulid } from "../../domain/ids/ulid";
import { isAlive } from "../../domain/model/base";
import type { Member } from "../../domain/model/member";
import type { ShoppingEntry, ShoppingReason } from "../../domain/projections/shopping";
import { formatMoney } from "../item/labels";

/** "Esgotado" | "Abaixo do mínimo". */
export function reasonLabel(reason: ShoppingReason): string {
  return reason === "out" ? "Esgotado" : "Abaixo do mínimo";
}

/** "Café em grãos Torrado 1 kg"; sem tamanho, só o nome. */
export function entryTitle(entry: Pick<ShoppingEntry, "name" | "size">): string {
  return `${entry.name} ${entry.size}`.trim();
}

/** Nome do morador vivo com o id, ou "outro morador" (a linha dele ainda nao chegou pelo sync). */
export function requesterName(id: Ulid | null, members: readonly Member[]): string {
  const member = id === null ? undefined : members.find((m) => m.id === id && isAlive(m));
  return member?.name ?? "outro morador";
}

/**
 * "3 pct · Abaixo do mínimo" | "3 pct · pedido por Ana" (item fixado) |
 * "2 · pedido por Ana" (pedido avulso, sem unidade).
 */
export function entryMeta(entry: ShoppingEntry, members: readonly Member[]): string {
  const amount = `${entry.qty} ${entry.unit}`.trim();
  const why =
    entry.reason === null
      ? `pedido por ${requesterName(entry.requestedBy, members)}`
      : reasonLabel(entry.reason);
  return `${amount} · ${why}`;
}

/**
 * Texto do botão de preço: digitado "R$ 85,80" (estimate false); só último
 * preço "~R$ 85,80" (estimate true); nenhum: null (a linha mostra "Preço").
 */
export function entryPrice(entry: ShoppingEntry): { text: string; estimate: boolean } | null {
  if (entry.priceMinor !== null) return { text: formatMoney(entry.priceMinor), estimate: false };
  if (entry.estimateMinor !== null) {
    return { text: `~${formatMoney(entry.estimateMinor)}`, estimate: true };
  }
  return null;
}

/** "2 de 6". */
export function progressLabel(done: number, total: number): string {
  return `${done} de ${total}`;
}

/** "Falta comprar" | "Falta comprar · Atacadão". */
export function footerLabel(store: string): string {
  const name = store.trim();
  return name === "" ? "Falta comprar" : `Falta comprar · ${name}`;
}

/** "+ 1 sem preço" | "+ 3 sem preço". */
export function unpricedLabel(n: number): string {
  return `+ ${n} sem preço`;
}

/**
 * Toast do repor. `items` são as linhas da despensa repostas, `extras` quantos
 * pedidos saíram.
 */
export function checkoutMessage(
  items: ReadonlyArray<{ qty: number; unit: string; name: string }>,
  extras: number,
): string {
  const [only] = items;
  const gone = extras === 1 ? "1 pedido saiu da lista" : `${extras} pedidos saíram da lista`;
  if (items.length === 0) return gone;
  const kept =
    items.length === 1 && extras === 0 && only !== undefined
      ? `Guardou ${`${only.qty} ${only.unit}`.trim()} de ${only.name}`
      : extras === 0
        ? `Guardou ${items.length} itens no estoque`
        : `Guardou ${items.length} ${items.length === 1 ? "item" : "itens"}`;
  return extras === 0 ? kept : `${kept} · ${gone}`;
}

/** Até 3 moradores vivos: o local primeiro, depois os outros por nome pt-BR. */
export function householdAvatars(members: readonly Member[], localId: Ulid | null): Member[] {
  const alive = members.filter((m) => isAlive(m));
  const local = alive.filter((m) => m.id === localId);
  const others = alive
    .filter((m) => m.id !== localId)
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return [...local, ...others].slice(0, 3);
}
