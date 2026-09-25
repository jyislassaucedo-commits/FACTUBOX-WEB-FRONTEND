/* Piezas que comparten las definiciones de complementos (complementos.ts y
   complementosExtra.ts). Van aparte para que ninguno de los dos importe al
   otro en tiempo de ejecución. */

export const CURP = /^[A-Z][AEIOUX][A-Z]{2}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;
export const RFC = /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/;

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Deja fuera los atributos vacíos: JSON_CFDI40 escribe un "" como atributo. */
export function sinVacios(obj: Record<string, string | undefined>) {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v.trim() !== "")
  ) as Record<string, string>;
}

/** Un importe como lo pide el SAT (t_Importe): punto decimal, sin comas. */
export function importe(v: string | undefined) {
  const n = Number(String(v ?? "").replace(/,/g, "").trim());
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n.toFixed(2) : "";
}

/** Las 32 entidades, con la clave del catálogo t_EntidadFederativa (01 Aguascalientes … 32 Zacatecas). */
export const ENTIDADES = [
  "Aguascalientes", "Baja California", "Baja California Sur", "Campeche", "Coahuila", "Colima",
  "Chiapas", "Chihuahua", "Ciudad de México", "Durango", "Guanajuato", "Guerrero", "Hidalgo",
  "Jalisco", "Estado de México", "Michoacán", "Morelos", "Nayarit", "Nuevo León", "Oaxaca",
  "Puebla", "Querétaro", "Quintana Roo", "San Luis Potosí", "Sinaloa", "Sonora", "Tabasco",
  "Tamaulipas", "Tlaxcala", "Veracruz", "Yucatán", "Zacatecas",
].map((nombre, i) => {
  const value = String(i + 1).padStart(2, "0");
  return { value, label: `${value} - ${nombre}` };
});
