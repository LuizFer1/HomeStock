import { describe, expect, it, vi } from "vitest";
import { resetDevice } from "./reset";
import { scopeResetDeps } from "./reset-scope";

const SCOPE = "https://luizfer1.github.io/HomeStock/";

describe("scopeResetDeps", () => {
  it("so apaga cache do HomeStock", async () => {
    const real = {
      keys: vi
        .fn()
        .mockResolvedValue(["homestock-precache-v2", "homefinance-precache", "workbox-runtime"]),
      delete: vi.fn().mockResolvedValue(true),
    };
    const { caches } = scopeResetDeps({ caches: real, scope: SCOPE });
    await resetDevice({ db: { delete: async () => {} }, caches, reload: vi.fn() });
    expect(real.delete).toHaveBeenCalledTimes(1);
    expect(real.delete).toHaveBeenCalledWith("homestock-precache-v2");
  });

  it("so desregistra o service worker do escopo do HomeStock", async () => {
    const ours = { scope: SCOPE, unregister: vi.fn() };
    const foreign = { scope: "https://luizfer1.github.io/homefinance/", unregister: vi.fn() };
    const { serviceWorker } = scopeResetDeps({
      serviceWorker: { getRegistrations: vi.fn().mockResolvedValue([foreign, ours]) },
      scope: SCOPE,
    });
    await resetDevice({ db: { delete: async () => {} }, serviceWorker, reload: vi.fn() });
    expect(ours.unregister).toHaveBeenCalled();
    expect(foreign.unregister).not.toHaveBeenCalled();
  });

  it("repassa ausencia", () => {
    expect(scopeResetDeps({ scope: SCOPE })).toEqual({
      caches: undefined,
      serviceWorker: undefined,
    });
  });
});
