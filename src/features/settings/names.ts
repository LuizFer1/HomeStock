export const MAX_PLACE_NAME = 40;

function key(s: string): string {
  return s
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

/**
 * Erro de nome para mostrar sob o campo, ou null. Repetido compara sem
 * maiuscula e sem acento ("Armario" = "Armário"), ignorando a propria linha.
 */
export function checkName(
  name: string,
  siblings: ReadonlyArray<{ id: string; name: string }>,
  selfId?: string,
): string | null {
  const trimmed = name.trim();
  if (trimmed === "") return "Dê um nome.";
  if (trimmed.length > MAX_PLACE_NAME) return `Use até ${MAX_PLACE_NAME} letras.`;
  const wanted = key(trimmed);
  const same = siblings.find((s) => s.id !== selfId && key(s.name) === wanted);
  return same === undefined ? null : `Já existe ${same.name}.`;
}
