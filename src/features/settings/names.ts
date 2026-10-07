import { MAX_PLACE_NAME } from "../../domain/model/place-name";
import { foldText } from "../../domain/text/fold-text";

export { MAX_PLACE_NAME };

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
  const wanted = foldText(trimmed);
  const same = siblings.find((s) => s.id !== selfId && foldText(s.name) === wanted);
  return same === undefined ? null : `Já existe ${same.name}.`;
}
