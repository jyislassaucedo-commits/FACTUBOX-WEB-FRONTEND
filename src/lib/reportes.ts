import { callLegacyPhpApi, callPhpApi } from "./phpApi";
import { getSession } from "./session";
import { getFacturas } from "./facturas";
import type { Factura } from "./facturasShared";

export type ReporteMensual = {
  TipoComprobante: string;
  /** Suma de importes del grupo (pesos), NO un conteo. */
  TotalFacturas: string;
  NumFacturas: string;
  Anio: string;
  Mes: string;
};

/** Mismo corte que ReporteMensual pero de comprobantes cancelados. */
export type ReporteCancelado = {
  TipoComprobante: string;
  TotalFacturas: string;
  TimbradosCancelados: string;
  Anio: string;
  Mes: string;
};

export type TimbresPorRfc = {
  Rfc: string;
  TimbradosUsados: string;
  TimbradosCancelados: string;
};

export type ReporteEmisor = {
  Rfc: string;
  Nombre: string;
  NumFacturas: number;
  TotalFacturas: number;
};

export type DashboardFilters = {
  rfc: string; // "" = todos los emisores
  anio: number;
  mes: string; // "" = todo el año, o "1".."12"
  tipo: string; // "TODO" o un TipoDeComprobante ("I","E","N","P","T")
};

export type DashboardData = {
  /** Agregado del año: monto y conteo por mes y tipo. */
  facturasEjercicio: ReporteMensual[];
  /** Mismo corte, solo canceladas (por mes y tipo). */
  canceladosEjercicio: ReporteCancelado[];
  /** Total de timbres cancelados en el ejercicio (todas las empresas). */
  totalCanceladasEjercicio: number;
  /** Timbres usados y cancelados por RFC en el ejercicio. */
  timbres: TimbresPorRfc[];
  /** El mismo agregado del año anterior, para comparar. */
  anioAnterior: ReporteMensual[];
  emisores: ReporteEmisor[];
  /**
   * Detalle factura por factura de UN mes (ver `periodoDetalle`). De aquí
   * salen los bloques que el reporte agregado no puede dar: top de clientes,
   * formas de pago y estatus ante el SAT.
   */
  detalle: Factura[];
  periodoDetalle: { anio: number; mes: number; desde: string; hasta: string };
};

function rangoMes(anio: number, mes: number) {
  const ultimoDia = new Date(anio, mes, 0).getDate();
  const mm = String(mes).padStart(2, "0");
  return {
    desde: `${anio}-${mm}-01`,
    hasta: `${anio}-${mm}-${String(ultimoDia).padStart(2, "0")}`,
  };
}

/** Pide a getReporteUsuarioV2 el corte anual de un ejercicio. */
async function reporteEjercicio(
  token: string,
  filters: Pick<DashboardFilters, "rfc" | "tipo">,
  anio: number
) {
  const anioStr = String(anio);
  const datosJSON = {
    Empresa: filters.rfc,
    NombreReceptor: "",
    RfcReceptor: "",
    MetodoPago: "TODO",
    FechaInicial: `${anioStr}-01-01`,
    FechaFinal: `${anioStr}-01-01`,
    FechaInicialEjercicio: `${anioStr}-01-01`,
    FechaFinalEjercicio: `${anioStr}-12-31`,
    Tipo: filters.tipo || "TODO",
    FechaInicialDia: `${anioStr}-01-01`,
    FechaFinalDia: `${anioStr}-01-01`,
  };

  // OJO con los nombres de campo de este endpoint - no son lo que parecen:
  // "CanceladosEjercicio" es en realidad el reparto de timbres POR RFC
  // (query getUsuarioReporte(): {rfc, timbresutilizados, timbrescancelados}),
  // no una serie mensual de cancelados. Y "TotalUsadosEjercicio" es un
  // escalar (la suma de timbresutilizados de todos los RFC), no un arreglo -
  // llamar .reduce() sobre el tal cual truena el tablero entero.
  // El desglose mes-a-mes de cancelados para el ejercicio viene en
  // "CanceladosEjercicioMes" (agregado backend/b519243 - antes solo existia
  // ese desglose para "Periodo", que aqui viene fijo a un solo dia).
  return callLegacyPhpApi<{
    FacturasEjercicio: ReporteMensual[];
    CanceladosEjercicio: TimbresPorRfc[];
    CanceladosEjercicioMes: ReporteCancelado[];
    TotalCanceladosEjercicio: number;
    TotalUsadosEjercicio: number;
  }>("/maa/mvc/Factura/api/getReporteUsuarioV2.php", {
    Token: token,
    DatosJSON: Buffer.from(JSON.stringify(datosJSON)).toString("base64"),
  });
}

/**
 * Datos del tablero de inicio.
 *
 * Estrategia híbrida a propósito:
 *
 * - Lo **anual** (monto y conteo por mes, canceladas, timbres, comparativo con
 *   el año pasado) sale del reporte agregado: una consulta que el backend
 *   resuelve con GROUP BY.
 * - Lo que el agregado **no puede dar** (quién es el cliente que más compra,
 *   PUE vs PPD, cuántas facturas traen estatus raro) necesita el detalle, y ese
 *   se pide de **un solo mes**: el filtrado, o el más reciente del año con
 *   actividad. `getFacturasV2.php` no pagina, así que traer el detalle de un
 *   año entero sería pesado sin ganar mucho.
 *
 * Nota: `getReporteUsuarioV2` devuelve además FacturasPeriodo, FacturasDia y
 * FacturasUltimo. No se usan porque dependen de los rangos FechaInicial/
 * FechaFinal/FechaInicialDia que aquí van fijos en un solo día — la actividad
 * reciente se saca del `detalle`, que sí está acotado y ordenado.
 */
export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData | null> {
  const session = await getSession();
  if (!session) return null;

  const anioStr = String(filters.anio);
  const tipo = filters.tipo || "TODO";
  const mes = filters.mes || "";

  const [actual, anterior, emisoresResp] = await Promise.all([
    reporteEjercicio(session.token, filters, filters.anio),
    reporteEjercicio(session.token, filters, filters.anio - 1),
    callPhpApi<{ Emisores: ReporteEmisor[] }>(
      "/endpoint/web/getReporteEmisoresWeb.php",
      {
        SessionToken: session.token,
        Anio: anioStr,
        Mes: mes,
        Tipo: tipo === "TODO" ? "" : tipo,
      }
    ),
  ]);

  const facturasEjercicio = actual.Error === "0" ? (actual.FacturasEjercicio ?? []) : [];
  const canceladosEjercicio =
    actual.Error === "0" ? (actual.CanceladosEjercicioMes ?? []) : [];
  const totalCanceladasEjercicio =
    actual.Error === "0" ? (actual.TotalCanceladosEjercicio ?? 0) : 0;
  const timbres = actual.Error === "0" ? (actual.CanceladosEjercicio ?? []) : [];
  const anioAnterior = anterior.Error === "0" ? (anterior.FacturasEjercicio ?? []) : [];

  // Mes del detalle: el filtrado, o el último del año con facturas. Se decide
  // con el agregado que ya tenemos, sin una consulta extra.
  const mesDetalle = mes
    ? parseInt(mes, 10)
    : facturasEjercicio.reduce(
        (max, r) =>
          (parseInt(r.NumFacturas, 10) || 0) > 0
            ? Math.max(max, parseInt(r.Mes, 10) || 0)
            : max,
        0
      ) || new Date().getMonth() + 1;

  const rango = rangoMes(filters.anio, mesDetalle);

  const detalle = await getFacturas({
    emisor: filters.rfc,
    tipo,
    estatus: "TODO",
    desde: rango.desde,
    hasta: rango.hasta,
  });

  return {
    facturasEjercicio,
    canceladosEjercicio,
    totalCanceladasEjercicio,
    timbres,
    anioAnterior,
    emisores: emisoresResp.Error === "0" ? (emisoresResp.Emisores ?? []) : [],
    detalle,
    periodoDetalle: { anio: filters.anio, mes: mesDetalle, ...rango },
  };
}
