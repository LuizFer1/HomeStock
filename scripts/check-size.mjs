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
 *           (56.02kb medidos: 51.59kb JS + 4.43kb CSS). Categorias e locais, CSV e
 *           sair da casa entraram depois, sem elevar o teto: medida final da fatia 2
 *           em 59.15kb (54.67kb JS + 4.48kb CSS), 5.85kb de folga.
 *   75kb  — fatia 3, Estoque: lista com busca, filtros, cards com long-press,
 *           action sheet e toast com desfazer (65.10kb medidos: 59.43kb JS +
 *           5.67kb CSS). Detalhe e formulario de item entraram depois, sem elevar
 *           o teto: medida final da fatia 3 em 69.17kb (63.25kb JS + 5.91kb CSS),
 *           5.83kb de folga. Fatia 4 sem elevar o teto: dados do scanner e
 *           camera/leitor no shell (o zxing fica fora) em 70.89kb (64.96kb JS +
 *           5.93kb CSS); com visor, preco, reposicao e a tela Adicionar, medida
 *           final da fatia 4 em 74.14kb (67.97kb JS + 6.17kb CSS), 0.86kb de folga.
 *   85kb  — fatia 5, Compras: a marca da lista (listMarks), pedidos validados e o
 *           repor em lote no repositorio estouraram o teto ja na primeira tarefa
 *           (75.02kb medidos: 68.86kb JS + 6.17kb CSS). A aba Compras, o sheet
 *           Ajustar e o CTA do Detalhe ainda entram nesta fatia.
 *
 * Service worker e runtime do Workbox nao entram: sao o preco de offline e
 * instalabilidade, nao do first paint. Ver isAppShellArtifact. O leitor zxing
 * tem orcamento proprio, SCANNER_LIMIT_BYTES.
 */
export const LIMIT_BYTES = 85 * 1024;

/**
 * Teto das fontes woff2. Ja vem comprimidas, gzip nao as reduz; medidas a parte
 * para uma fonte nova nao esconder crescimento de codigo, e vice-versa.
 * Historico:
 *   80kb  — Caprasimo 400 e Figtree 400/600/700, subset latin.
 */
export const FONT_LIMIT_BYTES = 80 * 1024;

/**
 * Teto do leitor de codigo de barras (zxing-wasm), baixado por `import()` so
 * onde nao ha BarcodeDetector nativo e fora do precache. Historico:
 *   500kb — fatia 4: zxing-wasm 3.1.5, chunk `zxing-reader-*.js` mais
 *           `zxing_reader-*.wasm` (420.84kb medidos, gzip). Folga larga de
 *           proposito: so segura o acidente de o chunk arrastar o shell ou de
 *           o build deixar de separar o .wasm.
 */
export const SCANNER_LIMIT_BYTES = 500 * 1024;

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

/**
 * Artefatos do leitor: o chunk do `import()` e o .wasm. O prefixo vem dos nomes
 * de `src/features/scanner/zxing-reader.ts` e do arquivo do pacote; renomear
 * la sem mudar aqui joga o leitor de volta no teto do app.
 * @param {string} relativePath
 */
export function isScannerArtifact(relativePath) {
  const base = path.basename(relativePath).toLowerCase();
  return base.startsWith("zxing") && /\.(js|wasm)$/.test(base);
}

/**
 * O que conta no teto do app: o shell sem o leitor sob demanda.
 * @param {string} relativePath
 */
export function isAppArtifact(relativePath) {
  return isAppShellArtifact(relativePath) && !isScannerArtifact(relativePath);
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
export async function measureDist(dir, include = isAppArtifact, gzip = true) {
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
  const scanner = report(
    "leitor (gzip)",
    await measureDist(dir, isScannerArtifact),
    SCANNER_LIMIT_BYTES,
    "SCANNER_LIMIT_BYTES",
  );
  // Os relatorios saem todos antes de falhar: estourar um nao esconde o outro.
  if (!app || !fonts || !scanner) process.exit(1);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
