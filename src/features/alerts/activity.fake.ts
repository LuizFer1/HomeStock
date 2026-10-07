import type { HomeStockDb } from "../../data/db";
import { formatHlc } from "../../domain/clock/hlc";
import type { Ulid } from "../../domain/ids/ulid";
import type { ListExtra } from "../../domain/model/list-extra";
import type { Member } from "../../domain/model/member";
import type { Movement } from "../../domain/model/movement";

/** 26 caracteres do alfabeto Crockford (sem I, L, O, U). */
export const RAFA_ID = "01J9F3K2M7QX8YB4TVWZ0RAFA0";

let seq = 0;

function base(createdAt: string) {
  seq += 1;
  return {
    id: `R${String(seq).padStart(25, "0")}`,
    createdAt,
    // Maior que os HLCs dos testes: o relogio deles fica em 2026.
    updatedAt: formatHlc({ millis: Date.parse(createdAt), counter: 0, deviceId: RAFA_ID }),
    deletedAt: null,
    dirty: 0 as const,
    authorId: RAFA_ID,
  };
}

/** Grava direto no banco o morador Rafa (salvia), como se tivesse chegado pelo sync. */
export async function putRafa(db: HomeStockDb): Promise<Member> {
  const row: Member = {
    ...base("2026-09-01T12:00:00.000Z"),
    id: RAFA_ID,
    name: "Rafa",
    color: "salvia",
    photo: null,
    role: "member",
  };
  await db.members.put(row);
  return row;
}

/** Grava um movimento de Rafa (authorId RAFA_ID). */
export async function putRafaMovement(
  db: HomeStockDb,
  itemId: Ulid,
  delta: number,
  createdAt: string,
  reason: "use" | "restock" = delta < 0 ? "use" : "restock",
): Promise<Movement> {
  const row: Movement = { ...base(createdAt), itemId, delta, reason };
  await db.movements.put(row);
  return row;
}

/** Grava um pedido avulso de Rafa (requestedBy e authorId RAFA_ID, qty null, checked 0). */
export async function putRafaRequest(
  db: HomeStockDb,
  name: string,
  createdAt: string,
): Promise<ListExtra> {
  const row: ListExtra = {
    ...base(createdAt),
    name,
    qty: null,
    priceMinor: null,
    checked: 0,
    requestedBy: RAFA_ID,
  };
  await db.listExtras.put(row);
  return row;
}
