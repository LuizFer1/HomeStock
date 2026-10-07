import type { PhotoDeps } from "./photo";

/**
 * Ligacao com o navegador, e so isso.
 *
 * Nao tem teste unitario porque nao tem decisao: recorte, laco de qualidade e
 * teto vivem em `photo.ts`, que e puro e testado. `happy-dom` nao implementa
 * canvas, entao cobrir estas linhas exigiria um navegador de verdade para
 * verificar poucos argumentos de `drawImage`.
 *
 * Nenhuma dependencia nova: `createImageBitmap` e `toDataURL` sao nativos.
 */
export const browserPhotoDeps: PhotoDeps = {
  decode: (file) => createImageBitmap(file),

  // So ImageBitmap tem close; a fonte aqui sempre vem do decode acima.
  release: (source) => (source as ImageBitmap).close(),

  encode: async (source, crop, size, quality) => {
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext("2d");
    if (ctx === null) throw new Error("Nao foi possivel preparar a imagem neste navegador.");

    ctx.drawImage(
      source as CanvasImageSource,
      crop.x,
      crop.y,
      crop.size,
      crop.size,
      0,
      0,
      size,
      size,
    );

    const webp = canvas.toDataURL("image/webp", quality);
    // `toDataURL` cai para PNG em silencio onde WebP nao e suportado, e PNG
    // ignora a qualidade e estoura o teto. JPEG ainda responde ao laco.
    return webp.startsWith("data:image/webp") ? webp : canvas.toDataURL("image/jpeg", quality);
  },
};
