import { describe, expect, it, vi } from "vitest";
import { resetDevice } from "./reset";

function newDb() {
  return { delete: vi.fn().mockResolvedValue(undefined) };
}

describe("resetDevice", () => {
  it("apaga o banco e recarrega", async () => {
    const db = newDb();
    const reload = vi.fn();

    await resetDevice({ db, reload });

    expect(db.delete).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("limpa caches e registros de service worker quando existem", async () => {
    // Apagar so o IndexedDB deixaria o app carregando de um cache que espera
    // dados que nao existem mais.
    const caches = { keys: vi.fn().mockResolvedValue(["v1", "v2"]), delete: vi.fn() };
    const unregister = vi.fn();
    const serviceWorker = { getRegistrations: vi.fn().mockResolvedValue([{ unregister }]) };

    await resetDevice({ db: newDb(), caches, serviceWorker, reload: vi.fn() });

    expect(caches.delete).toHaveBeenCalledTimes(2);
    expect(caches.delete).toHaveBeenCalledWith("v1");
    expect(caches.delete).toHaveBeenCalledWith("v2");
    expect(unregister).toHaveBeenCalled();
  });

  it("nao quebra quando nao ha service worker nem cache", async () => {
    // Contextos sem Cache API / SW (sandbox de teste, browsers antigos):
    // o reset ainda apaga o IndexedDB e recarrega.
    await expect(resetDevice({ db: newDb(), reload: vi.fn() })).resolves.toBeUndefined();
  });

  it("falha ao limpar cache nao impede apagar o banco nem recarregar", async () => {
    const db = newDb();
    const reload = vi.fn();
    const caches = { keys: vi.fn().mockRejectedValue(new Error("nao permitido")), delete: vi.fn() };

    await resetDevice({ db, caches, reload });

    expect(db.delete).toHaveBeenCalled();
    expect(reload).toHaveBeenCalled();
  });

  it("falha ao desregistrar service worker nao impede a recarga", async () => {
    const reload = vi.fn();
    const serviceWorker = {
      getRegistrations: vi.fn().mockRejectedValue(new Error("nao permitido")),
    };

    await resetDevice({ db: newDb(), serviceWorker, reload });

    expect(reload).toHaveBeenCalled();
  });

  it("falha ao apagar o banco rejeita e nao recarrega", async () => {
    // Recarregar aqui esconderia o erro: o app voltaria com os dados intactos e
    // o usuario concluiria que o reset funcionou.
    const db = { delete: vi.fn().mockRejectedValue(new Error("banco bloqueado")) };
    const reload = vi.fn();

    await expect(resetDevice({ db, reload })).rejects.toThrow("banco bloqueado");
    expect(reload).not.toHaveBeenCalled();
  });

  it("apaga o banco antes de tocar em caches e service workers", async () => {
    const order: string[] = [];
    const db = {
      delete: vi.fn(async () => {
        order.push("db");
      }),
    };
    const caches = {
      keys: vi.fn(async () => {
        order.push("caches");
        return [];
      }),
      delete: vi.fn(),
    };
    const serviceWorker = {
      getRegistrations: vi.fn(async () => {
        order.push("sw");
        return [];
      }),
    };
    await resetDevice({ db, caches, serviceWorker, reload: vi.fn() });
    expect(order[0]).toBe("db");
    expect(order).toContain("caches");
    expect(order).toContain("sw");
  });
});
