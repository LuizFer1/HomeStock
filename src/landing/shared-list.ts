/** "x de y" e a largura da barra da lista de exemplo. */
export function listProgress(done: number, total: number): { label: string; width: string } {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return { label: `${done} de ${total}`, width: `${pct}%` };
}

/**
 * Liga a lista de exemplo de "Para dividir": cada toque marca ou desmarca o item
 * (aria-pressed) e o progresso acompanha. O estado mora no proprio DOM.
 */
export function bindSharedList(root: ParentNode): void {
  const items = [...root.querySelectorAll<HTMLButtonElement>("[data-list-item]")];
  const bar = root.querySelector<HTMLElement>("[data-list-bar]");
  const done = root.querySelector<HTMLElement>("[data-list-done]");

  const render = () => {
    const n = items.filter((b) => b.getAttribute("aria-pressed") === "true").length;
    const p = listProgress(n, items.length);
    if (bar) bar.style.width = p.width;
    if (done) done.textContent = p.label;
  };

  for (const item of items) {
    item.addEventListener("click", () => {
      item.setAttribute("aria-pressed", String(item.getAttribute("aria-pressed") !== "true"));
      render();
    });
  }
  render();
}
