export interface PhotoSpec {
  size: number;
  maxChars: number;
}

/** O maior avatar do handoff tem 170px (passo 3); 160 e 16KB cobrem sem pesar no sync. */
export const AVATAR_PHOTO: PhotoSpec = { size: 160, maxChars: 16 * 1024 };

export interface Crop {
  x: number;
  y: number;
  size: number;
}

/**
 * O minimo que o pipeline precisa saber da imagem decodificada. `ImageBitmap`
 * satisfaz esta forma, e o teste passa um literal sem precisar de canvas.
 */
export interface PhotoSource {
  width: number;
  height: number;
}

export interface PhotoDeps {
  decode: (file: Blob) => Promise<PhotoSource>;
  encode: (source: PhotoSource, crop: Crop, size: number, quality: number) => Promise<string>;
}

/** Da melhor para a pior: o primeiro degrau resolve a foto simples, o ultimo e a ultima chance. */
export const QUALITIES = [0.8, 0.6, 0.45] as const;

/** Recorte quadrado central, em vez de um editor com pinca e zoom. */
export function squareCrop(width: number, height: number): Crop {
  const size = Math.min(width, height);
  return {
    x: Math.round((width - size) / 2),
    y: Math.round((height - size) / 2),
    size,
  };
}

/**
 * Decodifica uma vez e tenta as tres qualidades. Lanca "Essa imagem é grande
 * demais. Tente uma foto mais simples ou menor." quando nenhuma cabe: gravar a
 * versao gigante incharia a linha que viaja inteira em todo sync, e devolver
 * `null` em silencio faria a pessoa achar que a foto foi salva.
 */
export async function processPhoto(file: Blob, deps: PhotoDeps, spec: PhotoSpec): Promise<string> {
  const source = await deps.decode(file);
  const crop = squareCrop(source.width, source.height);

  for (const quality of QUALITIES) {
    const uri = await deps.encode(source, crop, spec.size, quality);
    if (uri.length <= spec.maxChars) return uri;
  }

  throw new Error("Essa imagem é grande demais. Tente uma foto mais simples ou menor.");
}
