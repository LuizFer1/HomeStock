import { compareHlc } from "../clock/hlc";
import type { BaseRow } from "./base";

/**
 * LWW por linha: vence o maior `updatedAt`. Empate exato fica com a local.
 *
 * E por linha, nao por campo: se um celular renomeia o item e o outro muda o
 * minimo depois, a linha inteira do segundo vence e a renomeacao se perde. Por
 * isso a quantidade nao mora no item.
 */
export function mergeRow<T extends BaseRow>(local: T | undefined, remote: T): T {
  if (local === undefined) return remote;
  return compareHlc(remote.updatedAt, local.updatedAt) > 0 ? remote : local;
}
