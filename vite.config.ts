/// <reference types="vitest/config" />

import { resolve } from "node:path";
import preact from "@preact/preset-vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

// GitHub Pages de projeto serve o site em /<repo>/, aqui
// https://luizfer1.github.io/HomeStock/. Manifest, SW e icones saem daqui;
// renomear o repositorio muda o caminho e esta constante tem que acompanhar.
const BASE = "/HomeStock/";
/** Onde o app mora. A landing fica na raiz do BASE. */
export const APP_PATH = `${BASE}app/`;
export const NAVIGATE_FALLBACK = `${APP_PATH}index.html`;
/** Navegacao perdida fora do app nao pode abrir o app no lugar da landing. */
export const NAVIGATE_FALLBACK_ALLOWLIST = [/\/app\//];

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

export const PWA_MANIFEST = {
  name: "HomeStock",
  short_name: "HomeStock",
  description: "Despensa e lista de compras da casa. Offline, dados so neste aparelho.",
  lang: "pt-BR",
  dir: "ltr" as const,
  // scope cobre a landing e o app: o beforeinstallprompt so dispara numa pagina
  // dentro do escopo. id e start_url apontam para o app: o icone instalado nunca
  // abre a vitrine, e mudar o id depois faria o navegador ver outro app.
  id: APP_PATH,
  start_url: APP_PATH,
  scope: BASE,
  display: "standalone" as const,
  orientation: "portrait-primary" as const,
  background_color: "#f5ead8",
  theme_color: "#f5ead8",
  icons: MANIFEST_ICONS,
};

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
      manifest: PWA_MANIFEST,
      workbox: {
        // Mesma origem do HomeFinance: o prefixo deixa o reset achar so os caches deste app.
        cacheId: "homestock",
        clientsClaim: true,
        navigateFallback: NAVIGATE_FALLBACK,
        navigateFallbackAllowlist: NAVIGATE_FALLBACK_ALLOWLIST,
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
    rollupOptions: {
      // A chave de cada entrada vira o prefixo dos arquivos (landing-*, app-*) e e
      // por ele que o check-size separa os orcamentos.
      input: {
        landing: resolve(import.meta.dirname, "index.html"),
        app: resolve(import.meta.dirname, "app/index.html"),
      },
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.mjs"],
  },
});
