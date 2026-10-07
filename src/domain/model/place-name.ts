export const MAX_PLACE_NAME = 40;

/** Nome de categoria ou local com trim, 1..40 letras. Lanca. */
export function normalizePlaceName(name: string): string {
  const trimmed = name.trim();
  if (trimmed === "") throw new Error("Dê um nome.");
  if (trimmed.length > MAX_PLACE_NAME) throw new Error(`Use até ${MAX_PLACE_NAME} letras.`);
  return trimmed;
}
