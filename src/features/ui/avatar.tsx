import { isPhotoDataUrl, type MemberColor } from "../../domain/model/member";
import { MEMBER_COLOR_STYLE } from "./member-color";

export interface AvatarProps {
  name: string;
  color: MemberColor;
  photo: string | null;
  size: number;
  class?: string;
}

/** Primeira letra do nome (como o handoff), "?" sem nome. Array.from por causa de emoji. */
export function initialOf(name: string): string {
  const first = Array.from(name.trim())[0];
  return first === undefined ? "?" : first.toUpperCase();
}

export function Avatar({ name, color, photo, size, class: extra }: AvatarProps) {
  const box = { width: `${size}px`, height: `${size}px` };
  if (isPhotoDataUrl(photo)) {
    return (
      <img
        src={photo}
        alt={`Foto de ${name}`}
        style={box}
        class={`shrink-0 rounded-pill object-cover ${extra ?? ""}`}
      />
    );
  }
  const { fill, ink } = MEMBER_COLOR_STYLE[color];
  return (
    <span
      role="img"
      aria-label={name}
      style={{ ...box, background: fill, color: ink, fontSize: `${size * 0.46}px` }}
      class={`flex shrink-0 items-center justify-center rounded-pill font-heading ${extra ?? ""}`}
    >
      {initialOf(name)}
    </span>
  );
}
