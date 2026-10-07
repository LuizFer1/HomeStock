/**
 * Baixa texto como arquivo sem rede: Blob, object URL e <a download>. O
 * revoke espera o tick seguinte; revogar no mesmo tick cancela o download no Safari.
 */
export function downloadText(
  filename: string,
  text: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
