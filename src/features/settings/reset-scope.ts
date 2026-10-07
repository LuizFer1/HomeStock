import type { ResetDeps } from "./reset";

/** Prefixo do `workbox.cacheId` em vite.config.ts: todo cache do HomeStock o carrega. */
export const CACHE_ID = "homestock";

/**
 * O app mora em github.io/HomeStock/, mesma origem do HomeFinance. `caches.keys()`
 * e `getRegistrations()` enxergam a origem inteira, entao o reset so pode tocar
 * no que e deste app: caches com o nosso prefixo e o registro do nosso escopo.
 */
export function scopeResetDeps(input: {
  caches?: NonNullable<ResetDeps["caches"]>;
  serviceWorker?: NonNullable<ResetDeps["serviceWorker"]>;
  /** URL absoluta do escopo do SW (`new URL(BASE_URL, location.href).href`). */
  scope: string;
}): Pick<ResetDeps, "caches" | "serviceWorker"> {
  const { caches, serviceWorker, scope } = input;
  return {
    caches:
      caches === undefined
        ? undefined
        : {
            keys: async () => (await caches.keys()).filter((key) => key.includes(CACHE_ID)),
            delete: (key) => caches.delete(key),
          },
    serviceWorker:
      serviceWorker === undefined
        ? undefined
        : {
            getRegistrations: async () =>
              (await serviceWorker.getRegistrations()).filter(
                (registration) => (registration as { scope?: string }).scope === scope,
              ),
          },
  };
}
