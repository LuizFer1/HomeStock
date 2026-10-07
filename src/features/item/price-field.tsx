import type { JSX } from "preact";
import { TextField } from "../ui/text-field";
import { maskPrice } from "./money";

export interface PriceFieldProps {
  id: string;
  /** Texto ja mascarado ("" ou "R$ 42,90"). */
  value: string;
  /** Padrao "R$ 0,00"; a reposicao passa o ultimo preco. */
  placeholder?: string;
  onChange: (text: string, minor: number | null) => void;
}

/** Campo de preco em centavos; o rotulo e de quem usa (`<label htmlFor>`). */
export function PriceField({
  id,
  value,
  placeholder = "R$ 0,00",
  onChange,
}: PriceFieldProps): JSX.Element {
  return (
    <TextField
      dense
      id={id}
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={placeholder}
      onInput={(event) => {
        const el = event.currentTarget;
        const next = maskPrice(el.value);
        // Tecla recusada nao muda o estado e o Preact nao redesenha: o DOM ficaria com ela.
        el.value = next.text;
        try {
          // Os digitos entram pela direita: o cursor fica no fim.
          el.setSelectionRange(next.text.length, next.text.length);
        } catch {
          // Alguns navegadores recusam a selecao em certos tipos de input.
        }
        onChange(next.text, next.minor);
      }}
    />
  );
}
