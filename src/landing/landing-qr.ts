import qrcode from "qrcode-generator";

/**
 * SVG do QR (correcao M) num path so, cor #201e1d, viewBox em modulos. Unico
 * modulo que importa a lib: so chega ao navegador por import() dinamico.
 */
export function qrSvg(payload: string): string {
  const qr = qrcode(0, "M");
  qr.addData(payload);
  qr.make();
  const size = qr.getModuleCount();
  let d = "";
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      // Um quadrado 1x1 por modulo escuro; crispEdges evita costura entre eles.
      if (qr.isDark(row, col)) d += `M${col} ${row}h1v1h-1z`;
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><path fill="#201e1d" d="${d}"/></svg>`;
}
