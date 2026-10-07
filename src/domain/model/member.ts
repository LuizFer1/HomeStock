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
