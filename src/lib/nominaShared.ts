/* Helpers puros de nómina, sin nada de servidor.
 *
 * Separado de nomina.ts por lo mismo que catalogosNominaShared: ese módulo
 * llama a getSession(), que depende de next/headers, y un componente cliente
 * que importe de ahí se lleva por delante todo el módulo. */

/** Periodicidades que el sistema sabe correr, con los días que suele pagar
 *  cada una. Se usan para proponer, no para imponer: una quincena de febrero
 *  paga 13 o 14 días y quien la corre lo corrige. */
export const PERIODICIDADES_CORRIBLES = [
  { clave: "01", label: "Diario", dias: "1" },
  { clave: "02", label: "Semanal", dias: "7" },
  { clave: "03", label: "Catorcenal", dias: "14" },
  { clave: "04", label: "Quincenal", dias: "15" },
  { clave: "05", label: "Mensual", dias: "30" },
  { clave: "10", label: "Decenal", dias: "10" },
] as const;

export function etiquetaPeriodicidad(clave: string): string {
  return PERIODICIDADES_CORRIBLES.find((p) => p.clave === clave)?.label ?? clave;
}

export const TIPOS_NOMINA = [
  { clave: "O", label: "Ordinaria" },
  { clave: "E", label: "Extraordinaria (aguinaldo, finiquito)" },
] as const;

/**
 * Propone el periodo siguiente a partir de hoy.
 *
 * Para la quincenal, que es la más común, se propone la quincena en curso: del
 * 1 al 15 o del 16 al fin de mes. La fecha de pago se deja el día del corte,
 * que es lo más frecuente, y quien corra la nómina la mueve si paga después.
 */
export function proponerPeriodo(periodicidad: string, hoy = new Date()) {
  const y = hoy.getFullYear();
  const m = hoy.getMonth();
  const d = hoy.getDate();
  const iso = (fecha: Date) =>
    `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;

  if (periodicidad === "04") {
    const primera = d <= 15;
    const inicio = new Date(y, m, primera ? 1 : 16);
    const fin = primera ? new Date(y, m, 15) : new Date(y, m + 1, 0);
    const dias = Math.round((fin.getTime() - inicio.getTime()) / 86_400_000) + 1;
    return { inicio: iso(inicio), fin: iso(fin), pago: iso(fin), dias: String(dias) };
  }

  if (periodicidad === "05") {
    const inicio = new Date(y, m, 1);
    const fin = new Date(y, m + 1, 0);
    return { inicio: iso(inicio), fin: iso(fin), pago: iso(fin), dias: String(fin.getDate()) };
  }

  const dias = Number(PERIODICIDADES_CORRIBLES.find((p) => p.clave === periodicidad)?.dias ?? "7");
  const fin = new Date(y, m, d);
  const inicio = new Date(y, m, d - dias + 1);
  return { inicio: iso(inicio), fin: iso(fin), pago: iso(fin), dias: String(dias) };
}

export function pesos(valor: string | number | null | undefined): string {
  const n = typeof valor === "number" ? valor : parseFloat(String(valor ?? ""));
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/** "15.000" que devuelve la base se lee mejor como "15". */
export function dias(valor: string | null | undefined): string {
  const n = parseFloat(String(valor ?? ""));
  if (!Number.isFinite(n)) return "—";
  return String(n % 1 === 0 ? n : Number(n.toFixed(3)));
}
