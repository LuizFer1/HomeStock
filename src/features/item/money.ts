import { formatMoney } from "./labels";

/** R$ 99.999,99: sete digitos cobrem qualquer compra de mercado. */
export const MAX_PRICE_MINOR = 9_999_999;

/**
 * Mascara de centavos: so os digitos contam, da direita para a esquerda
 * ("4290" -> "R$ 42,90"). Sem digitos (ou so zeros) o campo fica vazio.
 */
export function maskPrice(input: string): { text: string; minor: number | null } {
  const digits = input.replace(/\D/g, "").replace(/^0+/, "").slice(0, 7);
  if (digits === "") return { text: "", minor: null };
  const minor = Number(digits);
  return { text: formatMoney(minor), minor };
}
