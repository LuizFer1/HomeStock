import { describe, expect, it } from "vitest";
import { createRouter, type HistoryLike } from "./route";

function fakeHistory() {
  const entries: unknown[] = [];
  let backs = 0;
  const history: HistoryLike = {
    pushState: (data) => {
      entries.push(data);
    },
    back: () => {
      backs += 1;
    },
  };
  return { history, entries, backs: () => backs };
}

describe("router", () => {
  it("abre no inicio sem telas empilhadas", () => {
    const router = createRouter(fakeHistory().history);
    expect(router.tab.value).toBe("home");
    expect(router.top.value).toBeNull();
  });

  it("troca de aba", () => {
    const router = createRouter(fakeHistory().history);
    router.selectTab("stock");
    expect(router.tab.value).toBe("stock");
  });

  it("push empilha e grava uma entrada no historico", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "item", id: "A" });
    expect(router.top.value).toEqual({ kind: "item", id: "A" });
    expect(fake.entries).toEqual([{ depth: 1 }]);
  });

  it("back passa pelo historico e so o popstate desempilha", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "item", id: "A" });
    router.back();
    expect(fake.backs()).toBe(1);
    expect(router.stack.value).toHaveLength(1);
    router.onPopState();
    expect(router.top.value).toBeNull();
  });

  it("back sem telas nao mexe no historico", () => {
    const fake = fakeHistory();
    createRouter(fake.history).back();
    expect(fake.backs()).toBe(0);
  });

  it("popstate sem telas e ignorado", () => {
    const router = createRouter(fakeHistory().history);
    router.onPopState();
    expect(router.stack.value).toEqual([]);
  });

  it("nao troca de aba com tela aberta", () => {
    const router = createRouter(fakeHistory().history);
    router.push({ kind: "settings" });
    router.selectTab("shopping");
    expect(router.tab.value).toBe("home");
  });
});
