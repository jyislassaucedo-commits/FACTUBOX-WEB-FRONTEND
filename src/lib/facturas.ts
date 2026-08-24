import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { getEmisor } from "./emisores";
import {
  MOTIVOS_CANCELACION,
  type Factura,
  type FacturasFiltros,
} from "./facturasShared";

export { MOTIVOS_CANCELACION };
export type { Factura, FacturasFiltros };

const MODO_TIMBRADO = process.env.MODO_TIMBRADO || "PRUEBAS";

/**
 * Lista de facturas emitidas.
 *
 * OJO con dos cosas del backend (`getFacturasV2.php` → `DAO_FACTURA::searchFacturas`):
 *
 * 1. **No hay LIMIT ni paginación.** Devuelve todo lo que caiga en el rango,
 *    así que el rango siempre debe venir acotado desde la pantalla. El default
 *    de la UI es el mes en curso.
 * 2. **El rango filtra por `fechareg`** (fecha de registro en el sistema), no
 *    por `fechaemision`. Para CFDI timbrados en línea son prácticamente lo
 *    mismo, pero no lo son si alguna vez se importan facturas viejas.
 *
 * `UseXml: "NO"` es obligatorio aquí: con "SI" el backend adjunta el XML
 * completo de cada factura y la respuesta se vuelve de megabytes.
 */
export async function getFacturas(filtros: FacturasFiltros): Promise<Factura[]> {
  const session = await getSession();
  if (!session) return [];

  const datosJSON = {
    Empresa: filtros.emisor ?? "",
    Tipo: filtros.tipo || "TODO",
    EstatusFact: filtros.estatus || "TODO",
    NombreReceptor: "",
    RfcReceptor: "",
    MetodoPago: "TODO",
    FechaInicial: `${filtros.desde} 00:00:00`,
    FechaFinal: `${filtros.hasta} 23:59:59`,
    UseXml: "NO",
  };

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  const resp = await callLegacyPhpApi<{ Facturas: Factura[] }>(
    "/maa/mvc/Factura/api/getFacturasV2.php",
    { Token: session.token, DatosJSON: datosJSON64 }
  );

  if (resp.Error !== "0") return [];
  return resp.Facturas ?? [];
}

export type FacturaTimbre = {
  VersionCFDI: string;
  TipoDeComprobante: string;
  ConfigPdf: string;
  FechaTimbrado: string;
  UUID: string;
  CFDI_Base64: string;
};

/** XML timbrado (base64) de una factura. Es la fuente del panel de detalle. */
export async function getFacturaXml(
  uuid: string
): Promise<PhpResponse<FacturaTimbre>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi<FacturaTimbre>(
    "/maa/mvc/Factura/api/getFacturaTimbV2.php",
    { Token: session.token, UUID: uuid }
  );
}

export type CancelarResult = {
  UUID: string;
  Acuse?: string;
  EstatusUUID?: string;
};

/**
 * Cancelación REAL ante el SAT (`/endpoint/apiCancelacionV2.php`).
 *
 * No confundir con `setEstatusFacturaV2.php`, que solo cambia la columna
 * `estatussat` en la base local sin avisarle al SAT — ese endpoint NO se usa
 * aquí a propósito.
 *
 * Consume un timbre de cancelación del saldo del usuario y requiere que el
 * emisor tenga su CSD cargado.
 */
export async function cancelarFactura(input: {
  rfcEmisor: string;
  rfcReceptor: string;
  uuid: string;
  motivo: string;
  folioSustitucion?: string;
}): Promise<PhpResponse<CancelarResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  // El endpoint identifica al emisor por su Token, y necesita el lugar de
  // expedición: ambos salen del propio emisor, no del cliente.
  const emisor = await getEmisor(input.rfcEmisor);
  if (!emisor) {
    return { Error: "1", DescripError: "El emisor no existe o no te pertenece" };
  }

  const datosJSON = {
    RFC_Emisor: emisor.Rfc,
    RFC_Receptor: input.rfcReceptor,
    LugarExpedicion: emisor.LugarExp,
    UUIDS: [
      {
        UUID: input.uuid,
        FolioSustitucion: input.folioSustitucion ?? "",
        Motivo: input.motivo,
      },
    ],
  };

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<CancelarResult>("/endpoint/apiCancelacionV2.php", {
    SessionToken: session.token,
    Token: emisor.Token,
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });
}

export type EstatusSatResult = {
  /** "Vigente" | "Cancelado" | "No Encontrado" */
  Estado: string;
  /** "Cancelable sin aceptación" | "Cancelable con aceptación" | "No cancelable" */
  EsCancelable: string;
  EstatusCancelacion: string;
  CodigoEstatus: string;
  ValidacionEfos?: string;
  DetallesValidacionEfos?: string;
  Fecha?: string;
};

/**
 * Consulta el estatus real de un CFDI ante el SAT (`/endpoint/apiEstatusV2.php`).
 *
 * Ojo con dos cosas:
 *
 * 1. **El endpoint ya persiste el resultado**: internamente llama a
 *    `editEstatusTimbrado()`, que escribe `Estado` en la columna `estatussat`
 *    de la factura. Por eso NO hay que llamar además a `setEstatusFacturaV2`.
 * 2. **Usa el CSD del emisor** para firmar la consulta, así que un emisor sin
 *    certificado cargado no puede validar nada.
 *
 * Es una llamada SOAP al SAT: tarda. Quien la use en lote debe ir por tandas.
 */
export async function consultarEstatusSat(input: {
  emisorToken: string;
  rfcEmisor: string;
  rfcReceptor: string;
  uuid: string;
  total: string;
}): Promise<PhpResponse<EstatusSatResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON = {
    RFC_Emisor: input.rfcEmisor,
    RFC_Receptor: input.rfcReceptor,
    UUID: input.uuid,
    // El SAT compara el total contra el del comprobante: debe ir con dos
    // decimales o la consulta responde "No Encontrado" aunque exista.
    TotalCfdi: (parseFloat(input.total) || 0).toFixed(2),
  };

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<EstatusSatResult>("/endpoint/apiEstatusV2.php", {
    SessionToken: session.token,
    Token: input.emisorToken,
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });
}

/**
 * PDF (representación impresa) de una factura ya timbrada.
 *
 * `idConfigPdf` es opcional: si no se manda, el backend usa el diseño que ya
 * traía la factura al timbrarse (`FACTURA.idconfigpdf`), y si tampoco hay
 * eso, cae a un diseño por default. Se manda cuando el usuario elige
 * explícitamente con qué diseño generar el PDF (ver PdfConfigPicker).
 */
export async function getFacturaPdf(
  uuid: string,
  idConfigPdf?: string
): Promise<PhpResponse<{ PDF_Base64: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi<{ PDF_Base64: string }>(
    "/maa/mvc/Factura/api/getFacturaPdfV2.php",
    {
      Token: session.token,
      UUID: uuid,
      ...(idConfigPdf ? { IdConfigPdf: idConfigPdf } : {}),
    }
  );
}
