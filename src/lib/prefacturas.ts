import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { buildDatosJSON } from "./timbrado";
import type { CuerpoFactura } from "./facturaEntrada";
import { borradorDesdeCfdi, type PrefacturaAbierta } from "./cartaPorte/leerJson";
import { claveLocal } from "./cartaPorte/borrador";

/*
   Prefacturas en la nube (tabla PREFACTURA, maa/mvc/Prefactura/api/*WebV2).

   Son las mismas filas que sube Factubox Escritorio: el contenido es el base64
   del JSON del CFDI tal como se manda a timbrar (buildDatosJSON), así que lo
   que se guarda aquí lo abre el escritorio y al revés.
*/

const BASE = "/maa/mvc/Prefactura/api";

/** post_max_size del servidor es 8M: se deja margen para el resto del formulario. */
export const PREFACTURA_MAX_BYTES = 6_500_000;

export type PrefacturaResumen = {
  Id: number;
  UUIDLocal: string;
  Identificador: string;
  TipoComprobante: string;
  EsCartaPorte: boolean;
  RFCReceptor: string;
  NombreReceptor: string;
  Serie: string;
  Folio: string;
  Total: string;
  Moneda: string;
  Detalles: string;
  Origen: string;
  UbiGuardado: string;
  FechaReg: string;
  Bytes: number | null;
};

/** "Conceptos: 2  Complementos: Carta Porte", como lo escribe el escritorio. */
function detallesDe(datos: Record<string, unknown>) {
  const conceptos = ((datos.Conceptos as { Concepto?: unknown[] } | undefined)?.Concepto ?? []).length;
  const complementos = Object.keys((datos.Complemento as Record<string, unknown> | undefined) ?? {}).map((k) =>
    k === "CartaPorte" ? "Carta Porte" : k
  );
  return `Conceptos: ${conceptos}${complementos.length ? `  Complementos: ${complementos.join(", ")}` : ""}`;
}

export async function guardarPrefactura(
  rfcEmisor: string,
  uuidLocal: string,
  cuerpo: CuerpoFactura
): Promise<PhpResponse<{ Id: number; Result: string }> | { Error: "1"; DescripError: string }> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  // Sin addenda: las observaciones van en el borrador, la addenda se arma al timbrar.
  const { emisorToken: _token, ...input } = cuerpo;
  void _token;
  const datos = buildDatosJSON({ ...input, addenda: undefined }) as Record<string, unknown>;
  const base64 = Buffer.from(JSON.stringify(datos)).toString("base64");
  if (base64.length > PREFACTURA_MAX_BYTES) {
    return {
      Error: "1",
      DescripError: `La prefactura pesa ${(base64.length / 1_000_000).toFixed(1)} MB y el servidor acepta hasta ${(PREFACTURA_MAX_BYTES / 1_000_000).toFixed(1)} MB. Timbra en partes o reduce las mercancías.`,
    };
  }
  const receptor = (datos.Receptor ?? {}) as Record<string, string>;
  return callLegacyPhpApi<{ Id: number; Result: string }>(`${BASE}/setPrefacturaWebV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    UUIDLocal: uuidLocal,
    Base64: base64,
    TipoComprobante: String(datos.TipoDeComprobante ?? ""),
    Total: String(datos.Total ?? ""),
    Moneda: String(datos.Moneda ?? ""),
    RFCReceptor: receptor.Rfc ?? "",
    NombreReceptor: receptor.Nombre ?? "",
    RegimenReceptor: String(receptor.RegimenFiscalReceptor ?? ""),
    DomicilioReceptor: receptor.DomicilioFiscalReceptor ?? "",
    Serie: String(datos.Serie ?? ""),
    Folio: String(datos.Folio ?? ""),
    FormaPago: String(datos.FormaPago ?? ""),
    MetodoPago: String(datos.MetodoPago ?? ""),
    Detalles: detallesDe(datos),
    Identificador: `${datos.Serie ?? ""}-${datos.Folio ?? ""}`,
    Version: "web",
  });
}

export async function listarPrefacturas(
  rfcEmisor: string,
  { filtro = "todas", q = "", pagina = 1, por = 50 }: { filtro?: string; q?: string; pagina?: number; por?: number } = {}
): Promise<{ total: number; prefacturas: PrefacturaResumen[] } | null> {
  const session = await getSession();
  if (!session) return null;
  const resp = await callLegacyPhpApi<{ Total: number; Prefacturas: PrefacturaResumen[] }>(`${BASE}/getPrefacturasWebV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Filtro: filtro,
    Q: q,
    Pagina: String(pagina),
    Por: String(por),
  });
  if (resp.Error !== "0") return null;
  return { total: resp.Total ?? 0, prefacturas: resp.Prefacturas ?? [] };
}

export async function obtenerPrefactura(
  rfcEmisor: string,
  id: number
): Promise<PhpResponse<{ Prefactura: PrefacturaResumen; Base64: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi(`${BASE}/getPrefacturaWebV2.php`, { Token: session.token, RfcEmisor: rfcEmisor, Id: String(id) });
}

export async function borrarPrefactura(rfcEmisor: string, id: number): Promise<PhpResponse<{ Id: number }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi(`${BASE}/deletePrefacturaWebV2.php`, { Token: session.token, RfcEmisor: rfcEmisor, Id: String(id) });
}

/**
 * Una prefactura lista para el asistente: la trae, decodifica su JSON y lo
 * convierte en borrador. Con `duplicar` es una nueva (otra fila, otro IdCCP).
 */
export async function abrirPrefactura(
  rfcEmisor: string,
  id: number,
  duplicar: boolean
): Promise<{ ok: true; abierta: PrefacturaAbierta } | { ok: false; motivo: string }> {
  const resp = await obtenerPrefactura(rfcEmisor, id);
  if (resp.Error !== "0") return { ok: false, motivo: resp.DescripError || "No se encontró la prefactura" };
  let cfdi: Record<string, unknown>;
  try {
    cfdi = JSON.parse(Buffer.from(resp.Base64, "base64").toString("utf8"));
  } catch {
    return { ok: false, motivo: "El contenido de la prefactura no se puede leer" };
  }
  const lectura = borradorDesdeCfdi(cfdi, { rfcEmisor, duplicar });
  if (!lectura.ok) return lectura;
  const [a, m, d] = (resp.Prefactura.FechaReg ?? "").split("-");
  // Si algo no se pudo leer, el autoguardado no debe pisar la original (del
  // escritorio, casi siempre) con una versión a la que le falta: se trabaja
  // sobre una copia.
  const copia = duplicar || lectura.avisos.length > 0 || !resp.Prefactura.UUIDLocal;
  const avisos =
    copia && !duplicar && lectura.avisos.length > 0
      ? [...lectura.avisos, "Por eso se abrió como copia: la prefactura original queda intacta en la nube."]
      : lectura.avisos;
  return {
    ok: true,
    abierta: {
      borrador: lectura.borrador,
      uuidLocal: copia ? claveLocal() : resp.Prefactura.UUIDLocal,
      id: copia ? null : resp.Prefactura.Id,
      avisos,
      guardada: !copia && d ? `el ${d}/${m}/${a}` : undefined,
    },
  };
}
