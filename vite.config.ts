/// <reference types="vitest/config" />

import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages de projeto serve o site em /<repo>/, aqui
// https://luizfer1.github.io/HomeStock/. Manifest, SW e icones saem daqui;
// renomear o repositorio muda o caminho e esta constante tem que acompanhar.
const BASE = "/HomeStock/";

export const MANIFEST_ICONS = [
  { src: "img/icons/icon_any_192.png", sizes: "192x192", type: "image/png", purpose: "any" },
  { src: "img/icons/icon_any_512.png", sizes: "512x512", type: "image/png", purpose: "any" },
  {
    src: "img/icons/icon_maskable_192.png",
    sizes: "192x192",
    type: "image/png",
    purpose: "maskable",
  },
  {
    src: "img/icons/icon_maskable_512.png",
    sizes: "512x512",
    type: "image/png",
    purpose: "maskable",
  },
];

/**
 * O leitor zxing (~430kb gzip) fica fora do precache: o Chrome Android tem leitor
 * nativo e nao precisa dele. Entra no cache no primeiro uso e dai em diante
 * funciona offline. Os nomes casam com isScannerArtifact (scripts/check-size.mjs).
 */
export const SCANNER_GLOB_IGNORES = ["**/zxing-reader-*.js", "**/zxing_reader-*.wasm"];
export const SCANNER_CACHE = {
  urlPattern: /\/assets\/zxing[-_]reader-[^/]*\.(?:js|wasm)$/,
  // Nome com hash: o arquivo nunca muda, entao rede de novo e desperdicio.
  handler: "CacheFirst" as const,
  // `homestock` no nome: o "Sair da casa" apaga por prefixo (reset-scope.ts).
  options: { cacheName: "homestock-scanner", expiration: { maxEntries: 4 } },
};

export default defineConfig({
  base: BASE,
  // Sem numero de versao: cada push na main e um build novo, e a data dele e a versao.
  define: {
    __BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    preact(),
    tailwindcss(),
    // `prompt`: a versao nova instala e espera; o app avisa e so troca quando a
    // pessoa aceita (features/update/store.ts manda o SKIP_WAITING).
    VitePWA({
      registerType: "prompt",
      // Script externo em dist/registerSW.js: workbox-window fora do chunk da SPA.
      injectRegister: "script",
      includeAssets: ["img/icons/*.png"],
      manifest: {
        name: "HomeStock",
        short_name: "HomeStock",
        description: "Despensa e lista de compras da casa. Offline, dados so neste aparelho.",
        lang: "pt-BR",
        dir: "ltr",
        id: BASE,
        start_url: BASE,
        scope: BASE,
        display: "standalone",
        orientation: "portrait-primary",
        background_color: "#f5ead8",
        theme_color: "#f5ead8",
        icons: MANIFEST_ICONS,
      },
      workbox: {
        // Mesma origem do HomeFinance: o prefixo deixa o reset achar so os caches deste app.
        cacheId: "homestock",
        clientsClaim: true,
        navigateFallback: `${BASE}index.html`,
        globPatterns: ["**/*.{js,css,html,png,svg,ico,webp,woff2}"],
        globIgnores: SCANNER_GLOB_IGNORES,
        runtimeCaching: [SCANNER_CACHE],
      },
      // Em dev o SW atrapalha o HMR; so entra no build de producao.
      devOptions: { enabled: false },
    }),
  ],
  build: {
    target: "es2022",
    assetsInlineLimit: 0,
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
});
