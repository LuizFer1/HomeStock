function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 'YYYY-MM-DD' local. `toISOString` daria UTC e erraria o dia a noite. */
export function localToday(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
