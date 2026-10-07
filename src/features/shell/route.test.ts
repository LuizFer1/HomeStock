import { describe, expect, it } from "vitest";
import { closeIfStill, createRouter, type HistoryLike } from "./route";

function fakeHistory() {
  const entries: unknown[] = [];
  let backs = 0;
  const jumps: number[] = [];
  const history: HistoryLike = {
    pushState: (data) => {
      entries.push(data);
    },
    back: () => {
      backs += 1;
    },
    go: (delta) => {
      jumps.push(delta);
    },
  };
  return { history, entries, jumps, backs: () => backs };
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

  it("unwind volta todas as entradas de uma vez e resolve no popstate", async () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.push({ kind: "places" });
    let done = false;
    const pending = router.unwind().then(() => {
      done = true;
    });
    expect(fake.jumps).toEqual([-2]);
    await Promise.resolve();
    expect(done).toBe(false);
    router.onPopState();
    await pending;
    expect(done).toBe(true);
  });

  it("unwind sem telas resolve sem mexer no historico", async () => {
    const fake = fakeHistory();
    await createRouter(fake.history).unwind();
    expect(fake.jumps).toEqual([]);
  });

  it("back com um voltar em andamento nao volta de novo", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.back();
    router.back();
    expect(fake.backs()).toBe(1);
    router.onPopState();
    expect(router.stack.value).toEqual([]);
  });

  it("depois do popstate, back volta de novo", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.push({ kind: "places" });
    router.back();
    router.onPopState();
    router.back();
    expect(fake.backs()).toBe(2);
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

describe("closeIfStill", () => {
  it("volta com a mesma profundidade e o mesmo kind no topo", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.push({ kind: "profile" });
    closeIfStill(router, 2, "profile");
    expect(fake.backs()).toBe(1);
  });

  it("nao volta se a profundidade mudou", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.push({ kind: "profile" });
    closeIfStill(router, 3, "profile");
    expect(fake.backs()).toBe(0);
  });

  it("nao volta com outro kind no topo", () => {
    const fake = fakeHistory();
    const router = createRouter(fake.history);
    router.push({ kind: "settings" });
    router.push({ kind: "places" });
    closeIfStill(router, 2, "profile");
    expect(fake.backs()).toBe(0);
  });
});
