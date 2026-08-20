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
  mes: string; // "" = todo el año, o "1".."12"
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
  const mes = filters.mes || "";

  let fechaInicialEjercicio = `${anioStr}-01-01`;
  let fechaFinalEjercicio = `${anioStr}-12-31`;
  if (mes) {
    const mesNum = parseInt(mes, 10);
    const ultimoDia = new Date(filters.anio, mesNum, 0).getDate();
    const mesPad = String(mesNum).padStart(2, "0");
    fechaInicialEjercicio = `${anioStr}-${mesPad}-01`;
    fechaFinalEjercicio = `${anioStr}-${mesPad}-${String(ultimoDia).padStart(2, "0")}`;
  }

  const datosJSON = {
    Empresa: filters.rfc,
    NombreReceptor: "",
    RfcReceptor: "",
    MetodoPago: "TODO",
    FechaInicial: `${anioStr}-01-01`,
    FechaFinal: `${anioStr}-01-01`,
    FechaInicialEjercicio: fechaInicialEjercicio,
    FechaFinalEjercicio: fechaFinalEjercicio,
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
        Mes: mes,
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
