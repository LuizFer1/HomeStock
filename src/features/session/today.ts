export function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 'YYYY-MM-DD' local. `toISOString` daria UTC e erraria o dia a noite. */
export function localToday(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** dd/mm/aaaa no fuso local; null para ISO invalido. */
export function localDate(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

/** Dia local 'YYYY-MM-DD' de um ISO (createdAt de outro aparelho incluso). */
export function localDayOf(iso: string): string {
  return localToday(new Date(iso));
}
