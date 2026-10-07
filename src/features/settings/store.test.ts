import "fake-indexeddb/auto";
import { describe, expect, it } from "vitest";
import { ANA, openTestSession } from "../session/test-session.fake";
import { createSettingsStore } from "./store";

describe("createSettingsStore", () => {
  it("saveProfile muda o morador local", async () => {
    const { session } = await openTestSession({ member: ANA });
    await createSettingsStore(session).saveProfile({ ...ANA, color: "musgo" });
    expect(session.localMember.value?.color).toBe("musgo");
  });

  it("setPref reflete em session.prefs", async () => {
    const { session } = await openTestSession({ member: ANA });
    await createSettingsStore(session).setPref("autoList", false);
    expect(session.prefs.value.autoList).toBe(false);
  });

  it("saveProfile sem morador rejeita", async () => {
    const { session } = await openTestSession();
    await expect(createSettingsStore(session).saveProfile(ANA)).rejects.toThrow();
  });
});
