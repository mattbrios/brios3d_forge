// Preenchimento da barra de saldo de filamento a partir do Tom do material.

export interface MeterFill {
  color: string;
  outlined: boolean;
}

// Espelha `--ink-100` em `forge.css`, a cor do trilho `.bf-meter__track`.
const TRACK_HEX = "#f1f1f1";
// Abaixo deste contraste WCAG contra o trilho o Tom some, então ganha contorno.
const MIN_CONTRAST = 1.5;

const HEX = /^#[0-9a-f]{6}$/i;

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [darker, lighter] = [luminance(a), luminance(b)].sort((x, y) => x - y);
  return (lighter + 0.05) / (darker + 0.05);
}

/** `null` = sem Tom (ou material não encontrado): o `StockMeter` mantém o laranja padrão. */
export function meterFillFor(colorHex: string | null | undefined): MeterFill | null {
  if (!colorHex || !HEX.test(colorHex)) return null;
  return { color: colorHex, outlined: contrast(colorHex, TRACK_HEX) < MIN_CONTRAST };
}
