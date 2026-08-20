import type { ReporteMensual } from "@/lib/reportes";

export const TIPO_LABELS: Record<string, string> = {
  I: "Ingreso",
  E: "Egreso",
  N: "Nómina",
  P: "Pago",
  T: "Traslado",
};

// Orden fijo (nunca ciclar) - mismo orden usado en los tokens --series-N.
export const TIPO_ORDEN = ["I", "E", "N", "P", "T"];

export const TIPO_COLOR: Record<string, string> = {
  I: "var(--series-1)",
  E: "var(--series-2)",
  N: "var(--series-3)",
  P: "var(--series-4)",
  T: "var(--series-5)",
};

const MESES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

export function porMes(datos: ReporteMensual[]) {
  const totales = new Array(12).fill(0);
  for (const row of datos) {
    const mesIdx = parseInt(row.Mes, 10) - 1;
    if (mesIdx >= 0 && mesIdx < 12) {
      totales[mesIdx] += parseInt(row.NumFacturas, 10) || 0;
    }
  }
  return MESES.map((mes, i) => ({ mes, facturas: totales[i] }));
}

export function porTipo(datos: ReporteMensual[]) {
  const totales: Record<string, number> = {};
  for (const row of datos) {
    totales[row.TipoComprobante] =
      (totales[row.TipoComprobante] ?? 0) + (parseInt(row.NumFacturas, 10) || 0);
  }
  return TIPO_ORDEN.filter((tipo) => totales[tipo] > 0).map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo] ?? tipo,
    facturas: totales[tipo],
    color: TIPO_COLOR[tipo],
  }));
}

export function totalFacturas(datos: ReporteMensual[]) {
  return datos.reduce((acc, row) => acc + (parseInt(row.NumFacturas, 10) || 0), 0);
}
