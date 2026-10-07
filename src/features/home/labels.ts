/** "Oi, Ana!" (primeira palavra do nome); "Oi!" sem morador. */
export function greeting(name: string | null): string {
  const first = name?.trim().split(/\s+/)[0];
  return first === undefined || first === "" ? "Oi!" : `Oi, ${first}!`;
}

/** Subtitulo pela saude: o markup so tem o terceiro texto, os outros cobrem os extremos. */
export function healthSubtitle(health: number | null): string {
  if (health === null) return "Seu estoque ainda está vazio.";
  if (health >= 1) return "Sua casa está toda abastecida.";
  if (health >= 0.7) return "Sua casa está quase toda abastecida.";
  return "Alguns itens pedem atenção.";
}

/** "82%" | "—". */
export function healthPercent(health: number | null): string {
  if (health === null) return "—";
  // Nunca "100%" sem estar cheio, nem "0%" com um arco desenhado.
  const pct =
    health >= 1 ? 100 : health <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(health * 100)));
  return `${pct}%`;
}

/** "86 itens · 71 em dia" | "1 item · 1 em dia". */
export function itemsLine(items: number, ok: number): string {
  return `${items} ${items === 1 ? "item" : "itens"} · ${ok} em dia`;
}
