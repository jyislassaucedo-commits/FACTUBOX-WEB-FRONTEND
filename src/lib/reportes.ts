import { callLegacyPhpApi, callPhpApi } from "./phpApi";
import { getSession } from "./session";

export type ReporteMensual = {
  TipoComprobante: string;
  TotalFacturas: string;
  NumFacturas: string;
  Anio: string;
  Mes: string;
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
  tipo: string; // "TODO" o un TipoDeComprobante ("I","E","N","P")
};

export type DashboardData = {
  facturasEjercicio: ReporteMensual[];
  emisores: ReporteEmisor[];
};

export async function getDashboardData(
  filters: DashboardFilters
): Promise<DashboardData | null> {
  const session = await getSession();
  if (!session) return null;

  const anioStr = String(filters.anio);
  const tipo = filters.tipo || "TODO";

  const datosJSON = {
    Empresa: filters.rfc,
    NombreReceptor: "",
    RfcReceptor: "",
    MetodoPago: "TODO",
    FechaInicial: `${anioStr}-01-01`,
    FechaFinal: `${anioStr}-01-01`,
    FechaInicialEjercicio: `${anioStr}-01-01`,
    FechaFinalEjercicio: `${anioStr}-12-31`,
    Tipo: tipo,
    FechaInicialDia: `${anioStr}-01-01`,
    FechaFinalDia: `${anioStr}-01-01`,
  };

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  const [reporteResp, emisoresResp] = await Promise.all([
    callLegacyPhpApi<{ FacturasEjercicio: ReporteMensual[] }>(
      "/maa/mvc/Factura/api/getReporteUsuarioV2.php",
      { Token: session.token, DatosJSON: datosJSON64 }
    ),
    callPhpApi<{ Emisores: ReporteEmisor[] }>(
      "/endpoint/web/getReporteEmisoresWeb.php",
      {
        SessionToken: session.token,
        Anio: anioStr,
        Tipo: tipo === "TODO" ? "" : tipo,
      }
    ),
  ]);

  return {
    facturasEjercicio:
      reporteResp.Error === "0" ? reporteResp.FacturasEjercicio ?? [] : [],
    emisores: emisoresResp.Error === "0" ? emisoresResp.Emisores ?? [] : [],
  };
}
