import type { HomeStockDb } from "../../data/db";
import { openTestDb, seededRandom, testClock } from "../../data/test-db.fake";
import type { MemberDraft } from "../../domain/model/member";
import { createSession, type Session } from "./session";

export const ANA: MemberDraft = { name: "Ana", color: "terracota", photo: null };

/** Sessao pronta sobre fake-indexeddb; com `member`, ja passou pelo onboarding. */
export async function openTestSession(
  options: { member?: MemberDraft; now?: () => number } = {},
): Promise<{ db: HomeStockDb; session: Session }> {
  const db = openTestDb();
  const session = createSession({
    db,
    now: options.now ?? testClock(),
    randomChunk: seededRandom(1),
    today: () => "2026-10-06",
  });
  await session.init();
  const { member } = options;
  if (member !== undefined) await session.run((repo) => repo.createLocalMember(member));
  return { db, session };
}
