import { MEMBER_COLORS, type MemberColor } from "../../domain/model/member";
import { MEMBER_COLOR_STYLE } from "./member-color";

export interface ColorSwatchesProps {
  value: MemberColor;
  onChange: (color: MemberColor) => void;
  legend: string;
}

export function ColorSwatches({ value, onChange, legend }: ColorSwatchesProps) {
  return (
    <fieldset class="m-0 grid min-w-0 grid-cols-4 justify-items-center gap-[14px] border-0 p-0">
      <legend class="sr-only">{legend}</legend>
      {MEMBER_COLORS.map((color) => {
        const { label, fill } = MEMBER_COLOR_STYLE[color];
        const selected = color === value;
        return (
          <label
            key={color}
            class="flex size-[60px] cursor-pointer rounded-pill border-3 p-1 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2"
            style={{ borderColor: selected ? fill : "transparent" }}
          >
            <input
              type="radio"
              name="member-color"
              class="sr-only"
              aria-label={label}
              checked={selected}
              onChange={() => onChange(color)}
            />
            <span class="size-full rounded-pill" style={{ background: fill }} />
          </label>
        );
      })}
    </fieldset>
  );
}
