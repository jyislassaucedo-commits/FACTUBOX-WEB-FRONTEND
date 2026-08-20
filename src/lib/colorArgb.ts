// La BD guarda los colores como entero ARGB con signo (estilo Android
// Color.parseColor), ej. "-16777216" = negro opaco. Estas funciones
// convierten hacia/desde el formato hex #RRGGBB que usa <input type="color">.

export function hexToArgbInt(hex: string): string {
  const clean = hex.replace("#", "");
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  const unsigned = (0xff << 24) | (r << 16) | (g << 8) | b;
  return String(unsigned | 0); // fuerza a int32 con signo
}

export function argbIntToHex(argb: string | number, fallback = "#000000"): string {
  const val = typeof argb === "string" ? parseInt(argb, 10) : argb;
  if (Number.isNaN(val)) return fallback;
  const unsigned = val < 0 ? val + 0x100000000 : val;
  const r = (unsigned >> 16) & 0xff;
  const g = (unsigned >> 8) & 0xff;
  const b = unsigned & 0xff;
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}
