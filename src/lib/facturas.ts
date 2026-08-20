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

  const resp = await callLegacyPhpApi<CancelarResult>("/endpoint/apiCancelacionV2.php", {
    SessionToken: session.token,
    Token: emisor.Token,
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });

  // apiCancelacionV2.php cancela de verdad ante el SAT (crea el registro en
  // CANCELACION) pero NO toca FACTURA.estatussat, que es lo que lee el
  // listado (getFacturasV2.php). Sin este segundo paso la fila se queda con
  // el estatus viejo para siempre - aqui SI es correcto usar
  // setEstatusFacturaV2.php (a diferencia de usarlo en lugar de la
  // cancelación real): la cancelación ya sucedió, esto solo sincroniza el
  // cache local. Se manda "Cancelado" fijo (no resp.EstatusUUID): Finkok
  // regresa ahi un texto descriptivo la primera vez pero un codigo numerico
  // (ej. "201") si el UUID ya estaba cancelado - guardar eso tal cual
  // ensuciaria el estatus mostrado en la tabla. Si este paso falla, no se
  // revierte el resultado - la cancelación real ya es irreversible.
  if (resp.Error === "0") {
    await callLegacyPhpApi("/maa/mvc/Factura/api/setEstatusFacturaV2.php", {
      Token: session.token,
      UUID: input.uuid,
      Estatus: "Cancelado",
    }).catch(() => undefined);
  }

  return resp;
}

/* ---------------------------------------------------------------------------
   PDF — PENDIENTE
   ---------------------------------------------------------------------------
   Todavía no existe un endpoint que genere el PDF de una factura ya timbrada:
   en `public_html/maa/mvc/Factura/api/` solo hay listado, detalle, XML y
   estatus. La UI ya tiene el botón cableado a esta función para que cuando el
   endpoint exista solo haya que rellenar el cuerpo.

   Cuando se implemente, lo natural es que reciba el UUID y la ConfigPdf que ya
   trae la factura (`IdConfigPdf`) y devuelva el PDF en base64, igual que
   getFacturaTimbV2 hace con el XML.
--------------------------------------------------------------------------- */
export async function getFacturaPdf(
  uuid: string
): Promise<PhpResponse<{ PDF_Base64: string }>> {
  return {
    Error: "1",
    DescripError:
      `La generación de PDF todavía no está disponible: falta el endpoint en el backend (UUID ${uuid}).`,
  };
}
