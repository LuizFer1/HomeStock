import "fake-indexeddb/auto";
import { describe, expect, it, vi } from "vitest";
import { cafe } from "../../data/test-db.fake";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createSettingsStore } from "./store";

function deps() {
  return { download: vi.fn(), today: () => "2026-10-06" };
}

describe("createSettingsStore", () => {
  it("saveProfile muda o morador local", async () => {
    const { session } = await openTestSession({ member: ANA });
    await createSettingsStore(session, deps()).saveProfile({ ...ANA, color: "musgo" });
    expect(session.localMember.value?.color).toBe("musgo");
  });

  it("setPref reflete em session.prefs", async () => {
    const { session } = await openTestSession({ member: ANA });
    await createSettingsStore(session, deps()).setPref("autoList", false);
    expect(session.prefs.value.autoList).toBe(false);
  });

  it("saveProfile sem morador rejeita", async () => {
    const { session } = await openTestSession();
    await expect(createSettingsStore(session, deps()).saveProfile(ANA)).rejects.toThrow();
  });

  it("exportStock entrega o CSV ao download", async () => {
    const { session } = await openTestSession({ member: ANA });
    await session.run((repo) => repo.createItem(cafe(), 1));
    const d = deps();
    createSettingsStore(session, d).exportStock();
    expect(d.download).toHaveBeenCalledTimes(1);
    const [filename, text] = d.download.mock.calls[0] ?? [];
    expect(filename).toBe("homestock-estoque-2026-10-06.csv");
    expect(text).toContain("Café em grãos");
  });

  it("upsertCategory e upsertLocation aparam o nome", async () => {
    const { session } = await openTestSession({ member: ANA });
    const store = createSettingsStore(session, deps());
    await store.upsertCategory("  Bebidas ");
    await store.upsertLocation(" Garagem  ");
    expect(session.data.value.categories.some((c) => c.name === "Bebidas")).toBe(true);
    expect(session.data.value.locations.some((l) => l.name === "Garagem")).toBe(true);
  });

  it("removeCategory e removeLocation tiram a linha da vista", async () => {
    const { session } = await openTestSession({ member: ANA });
    const store = createSettingsStore(session, deps());
    const cat = session.data.value.categories[0];
    const loc = session.data.value.locations[0];
    if (!cat || !loc) throw new Error("sem sementes");
    await store.removeCategory(cat.id);
    await store.removeLocation(loc.id);
    const find = (rows: { id: string; deletedAt: string | null }[], id: string) =>
      rows.find((r) => r.id === id)?.deletedAt;
    expect(find(session.data.value.categories, cat.id)).toEqual(expect.any(String));
    expect(find(session.data.value.locations, loc.id)).toEqual(expect.any(String));
  });
});
