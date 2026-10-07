import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { gzipSync } from "node:zlib";

/**
 * Teto de JS + CSS gzipado do shell da SPA (first paint).
 * Elevar exige commit deliberado e revisavel, nunca de raspao junto com uma feature.
 * Historico:
 *   20kb  — infra base: Preact, signals, Tailwind com os tokens Organic, tab bar
 *           com 4 icones Lucide e o aviso de versao nova.
 *   55kb  — fatia 2: o Dexie entra no bundle com o repositorio aberto no main.tsx,
 *           mais a sessao com signals (48.84kb medidos). Os 6.16kb de folga sao
 *           deliberados: onboarding, ajustes e CSV ainda entram nesta fatia.
 *   65kb  — fatia 2, Ajustes: tela de ajustes, edicao de perfil e linhas editaveis
 *           (56.02kb medidos: 51.59kb JS + 4.43kb CSS), ainda faltam categorias e
 *           locais, CSV e sair da casa.
 *
 * Service worker e runtime do Workbox nao entram: sao o preco de offline e
 * instalabilidade, nao do first paint. Ver isAppShellArtifact.
 */
export const LIMIT_BYTES = 65 * 1024;

/**
 * Teto das fontes woff2. Ja vem comprimidas, gzip nao as reduz; medidas a parte
 * para uma fonte nova nao esconder crescimento de codigo, e vice-versa.
 * Historico:
 *   80kb  — Caprasimo 400 e Figtree 400/600/700, subset latin.
 */
export const FONT_LIMIT_BYTES = 80 * 1024;

const MEASURED = /\.(js|css)$/;

/**
 * Artefatos do shell da SPA. Exclui SW / Workbox / registerSW gerados pelo
 * vite-plugin-pwa.
 * @param {string} relativePath
 */
export function isAppShellArtifact(relativePath) {
  const base = path.basename(relativePath).toLowerCase();
  if (base === "sw.js" || base === "workbox-window.js") return false;
  if (base.startsWith("workbox-")) return false;
  if (base.includes("registersw")) return false;
  if (base.includes("precache")) return false;
  return MEASURED.test(base);
}

/** @param {string} relativePath */
export function isFontArtifact(relativePath) {
  return relativePath.toLowerCase().endsWith(".woff2");
}

/**
 * @param {string} dir
 * @param {(relativePath: string) => boolean} include
 * @param {boolean} gzip
 * @returns {Promise<{ total: number, files: Array<{ file: string, size: number }> }>}
 */
export async function measureDist(dir, include = isAppShellArtifact, gzip = true) {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  const files = [];
  let total = 0;

  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const full = path.join(entry.parentPath, entry.name);
    const relative = path.relative(dir, full);
    if (!include(relative)) continue;

    const size = gzip ? gzipSync(await readFile(full)).length : (await stat(full)).size;
    files.push({ file: relative, size });
    total += size;
  }

  files.sort((a, b) => b.size - a.size);
  return { total, files };
}

function kb(bytes) {
  return `${(bytes / 1024).toFixed(2)}kb`;
}

/**
 * @param {string} label
 * @param {{ total: number, files: Array<{ file: string, size: number }> }} measured
 * @param {number} limit
 * @param {string} constant
 * @returns {boolean} true se coube no teto
 */
function report(label, { total, files }, limit, constant) {
  console.log(`${label}:`);
  for (const { file, size } of files) {
    console.log(`  ${kb(size).padStart(9)}  ${file}`);
  }
  if (total > limit) {
    console.error(
      `FALHOU: ${label} em ${kb(total)}, acima do teto de ${kb(limit)}.\n` +
        `Reduza o bundle ou eleve ${constant} em scripts/check-size.mjs de forma deliberada.\n`,
    );
    return false;
  }
  console.log(`OK: ${kb(total)}, dentro do teto de ${kb(limit)}.\n`);
  return true;
}

async function main() {
  const dir = path.resolve("dist");
  const app = report("app (gzip)", await measureDist(dir), LIMIT_BYTES, "LIMIT_BYTES");
  const fonts = report(
    "fontes (woff2)",
    await measureDist(dir, isFontArtifact, false),
    FONT_LIMIT_BYTES,
    "FONT_LIMIT_BYTES",
  );
  // Os relatorios saem todos antes de falhar: estourar um nao esconde o outro.
  if (!app || !fonts) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
