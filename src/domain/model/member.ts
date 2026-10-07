import type { BaseRow } from "./base";

/** As oito cores do onboarding do handoff, por nome. */
export const MEMBER_COLORS = [
  "terracota",
  "salvia",
  "canela",
  "musgo",
  "damasco",
  "pistache",
  "cafe",
  "cacau",
] as const;

export type MemberColor = (typeof MEMBER_COLORS)[number];

/** Morador da casa. Cada celular cria o seu; os outros chegam pelo HubStock. */
export interface Member extends BaseRow {
  name: string;
  color: MemberColor;
  photo: string | null;
  role: "admin" | "member";
}

export type MemberDraft = Pick<Member, "name" | "color" | "photo">;
export const MAX_MEMBER_NAME = 40;

const PHOTO_PREFIXES = ["data:image/webp;", "data:image/jpeg;", "data:image/png;"] as const;

/**
 * Lista de permissao, nao de bloqueio: a linha pode vir de outro aparelho pelo
 * sync. SVG fica de fora (carrega script) e URL remota tambem (nenhuma
 * requisicao sai deste app).
 */
export function isPhotoDataUrl(value: string | null): value is string {
  return value !== null && PHOTO_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/** Nome com trim, 1..40; cor conhecida; foto nula ou data URL permitida. Lanca. */
export function normalizeMemberDraft(draft: MemberDraft): MemberDraft {
  const name = draft.name.trim();
  if (name === "") throw new Error("Informe seu nome.");
  if (name.length > MAX_MEMBER_NAME) throw new Error(`Use até ${MAX_MEMBER_NAME} letras no nome.`);
  if (!MEMBER_COLORS.includes(draft.color)) throw new Error("Cor desconhecida.");
  if (draft.photo !== null && !isPhotoDataUrl(draft.photo)) {
    throw new Error("Formato de foto não aceito.");
  }
  return { name, color: draft.color, photo: draft.photo };
}
