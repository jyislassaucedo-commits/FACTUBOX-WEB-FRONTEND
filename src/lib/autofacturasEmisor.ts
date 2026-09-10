import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getEmisor } from "./emisores";
import { getSession } from "./session";
import { buildDatosJSON, type ConceptoInput } from "./timbrado";
import type { EstadoAutofactura } from "./autofacturaShared";

// El lado del emisor (con sesión) de la autofactura por QR: ver y administrar
// las ventas que sus integradores dejaron pendientes de que el cliente
// facture. Habla con apiAutofacturaV2.php, el mismo endpoint que usan los
// integradores, con el token de sesión del usuario y el token del emisor.
// La parte pública (lo que ve el comprador) está en autofactura.ts.

const MODO_TIMBRADO = process.env.MODO_TIMBRADO || "PRUEBAS";

/** Un renglón de Tarea=LISTAR / ESTATUS. */
export type AutofacturaEmisor = {
  Codigo: string;
  Estado: EstadoAutofactura;
  Referencia: string;
  Total: string;
  Moneda: string;
  Expira: string;
  UUID: string;
  FechaTimbrado: string;
  EmailReceptor: string;
  CorreoEnviado: "SI" | "NO";
  CorreoError: string;
  Intentos: number;
  UltimoError: string;
  FechaReg: string;
  Url: string;
  UrlQR: string;
};

async function llamar<T>(rfcEmisor: string, tarea: string, extra: Record<string, string> = {}): Promise<PhpResponse<T>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const emisor = await getEmisor(rfcEmisor);
  if (!emisor) return { Error: "1", DescripError: "El emisor no existe o no te pertenece" };

  return callLegacyPhpApi<T>("/endpoint/apiAutofacturaV2.php", {
    SessionToken: session.token,
    Token: emisor.Token,
    Tarea: tarea,
    ...extra,
  });
}

export async function getAutofacturas(rfcEmisor: string): Promise<AutofacturaEmisor[]> {
  const resp = await llamar<{ Autofacturas: AutofacturaEmisor[] }>(rfcEmisor, "LISTAR", { Limite: "500" });
  if (resp.Error !== "0") return [];
  return resp.Autofacturas ?? [];
}

export async function cancelarAutofactura(rfcEmisor: string, codigo: string) {
  return llamar<{ Estado: EstadoAutofactura }>(rfcEmisor, "CANCELAR", { Codigo: codigo });
}

export async function reenviarCorreoAutofactura(rfcEmisor: string, codigo: string, email?: string) {
  return llamar<{ CorreoEnviado: "SI" | "NO"; CorreoError: string }>(rfcEmisor, "REENVIAR_CORREO", {
    Codigo: codigo,
    ...(email ? { EmailReceptor: email } : {}),
  });
}

/** Lo que captura el emisor para crear una autofactura desde el app. */
export type NuevaAutofacturaInput = {
  serie: string;
  formaPago: string;
  metodoPago: string;
  conceptos: ConceptoInput[];
  referencia?: string;
  emailReceptor?: string;
  /** Vacío = hasta fin de mes (el default del backend). */
  expiraEnDias?: number;
};

export type AutofacturaCreada = {
  Codigo: string;
  Url: string;
  UrlQR: string;
  Expira: string;
  CorreoEnviado: "SI" | "NO";
  CorreoError: string;
};

/**
 * Crea una autofactura sin integrador: el emisor captura los conceptos en el
 * app y obtiene el QR/enlace. Arma el mismo CFDI que una factura normal (con
 * buildDatosJSON) y lo manda a CREAR; el backend le quita el Receptor, que
 * es lo que el comprador va a poner.
 */
export async function crearAutofactura(
  rfcEmisor: string,
  input: NuevaAutofacturaInput
): Promise<PhpResponse<AutofacturaCreada>> {
  const emisor = await getEmisor(rfcEmisor);
  if (!emisor) return { Error: "1", DescripError: "El emisor no existe o no te pertenece" };

  const datosJSON = buildDatosJSON({
    tipoDeComprobante: "I",
    rfcEmisor: emisor.Rfc,
    nombreEmisor: emisor.Nombre,
    regimenEmisor: emisor.Regimen,
    lugarExpedicion: emisor.LugarExp,
    serie: input.serie,
    // Sin folio a propósito: se asigna cuando el comprador timbra, para no
    // dejar huecos por ventas que nadie factura.
    folio: "",
    formaPago: input.formaPago,
    metodoPago: input.metodoPago,
    // Receptor de relleno: el backend lo descarta. Tiene que ser uno "real"
    // (no XAXX010101000) para que buildDatosJSON no meta InformacionGlobal.
    receptorRfc: "AAAA010101AAA",
    receptorNombre: "-",
    receptorRegimenFiscal: "616",
    receptorDomicilioFiscal: emisor.LugarExp,
    receptorUsoCfdi: "S01",
    conceptos: input.conceptos,
  });

  return llamar<AutofacturaCreada>(rfcEmisor, "CREAR", {
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: Buffer.from(JSON.stringify(datosJSON)).toString("base64"),
    ...(input.referencia ? { Referencia: input.referencia } : {}),
    ...(input.emailReceptor ? { EmailReceptor: input.emailReceptor } : {}),
    ...(input.expiraEnDias ? { ExpiraEnDias: String(input.expiraEnDias) } : {}),
  });
}
