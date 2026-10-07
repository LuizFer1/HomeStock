/**
 * Chave de comparacao de texto: sem acento, sem caixa, sem espacos nas
 * pontas. "Armario" casa com "Armário" na busca e na checagem de repetido.
 */
export function foldText(text: string): string {
  return text
    .trim()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}
