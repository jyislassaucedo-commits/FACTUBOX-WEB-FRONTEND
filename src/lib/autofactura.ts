import { callPhpApi, fetchPhpAsset } from "./phpApi";
import { CAMPOS_BACKEND } from "./autofacturaShared";
import type {
  Autofactura,
  DatosReceptorAutofactura,
  ErrorTimbradoAutofactura,
  ResultadoTimbradoAutofactura,
} from "./autofacturaShared";

// Todo lo de aquí es público a propósito: no hay getSession(). Lo único que
// ata al comprador con su venta es el código de 48 hex, y ese ya lo tiene en
// la mano (ticket o correo). El backend valida el formato; aquí solo se evita
// mandarle basura.
const CODIGO_RE = /^[0-9a-f]{48}$/;

export function esCodigoValido(codigo: string): boolean {
  return CODIGO_RE.test(codigo);
}

/** Consulta pública: emisor, resumen, estado y (si está pendiente) catálogos. */
export async function consultarAutofactura(codigo: string): Promise<Autofactura | null> {
  if (!esCodigoValido(codigo)) return null;

  const resp = await callPhpApi<Autofactura>("/endpoint/web/autofacturaConsultarWeb.php", {
    Codigo: codigo,
  });
  if (resp.Error !== "0") return null;
  return resp;
}

// El error de autofacturaTimbrarWeb trae más campos que la envoltura genérica
// de PhpResponse (estado, campos, intentos, validación): se tipa aparte.
type RespuestaTimbrarPhp =
  | ({ Error: "0" } & ResultadoTimbradoAutofactura)
  | {
      Error: "1";
      DescripError: string;
      Estado?: Autofactura["Estado"];
      Campos?: Record<string, string>;
      Intentos?: number;
      MaxIntentos?: number;
      Validacion?: ErrorTimbradoAutofactura["validacion"];
    };

/**
 * El comprador manda su Receptor y el backend completa el JSON y timbra.
 * Devuelve el resultado o el error ya traducido a los nombres del formulario.
 */
export async function timbrarAutofactura(
  codigo: string,
  datos: DatosReceptorAutofactura
): Promise<{ ok: true; resultado: ResultadoTimbradoAutofactura } | { ok: false; error: ErrorTimbradoAutofactura; status: number }> {
  if (!esCodigoValido(codigo)) {
    return { ok: false, status: 404, error: { error: "Este enlace no corresponde a ninguna venta" } };
  }

  const resp = (await callPhpApi<ResultadoTimbradoAutofactura>("/endpoint/web/autofacturaTimbrarWeb.php", {
    Codigo: codigo,
    Rfc: datos.rfc,
    Nombre: datos.nombre,
    RegimenFiscal: datos.regimenFiscal,
    DomicilioFiscal: datos.domicilioFiscal,
    UsoCFDI: datos.usoCfdi,
    Email: datos.email,
  })) as unknown as RespuestaTimbrarPhp;

  if (resp.Error === "0") {
    return { ok: true, resultado: resp };
  }

  const campos: ErrorTimbradoAutofactura["campos"] = {};
  for (const [k, v] of Object.entries(resp.Campos ?? ({} as Record<string, string>))) {
    const campo = CAMPOS_BACKEND[k];
    if (campo) campos[campo] = v;
  }

  // El estado decide qué pantalla toca: ya timbrada por otro envío, vencida,
  // cancelada. El resto son errores del formulario o del timbrado.
  const status =
    resp.Estado === "TIMBRADA" ? 409
    : resp.Estado === "EXPIRADA" || resp.Estado === "CANCELADA" ? 410
    : Object.keys(campos).length > 0 ? 400
    : 422;

  return {
    ok: false,
    status,
    error: {
      error: resp.DescripError,
      estado: resp.Estado,
      campos: Object.keys(campos).length > 0 ? campos : undefined,
      intentos: resp.Intentos,
      maxIntentos: resp.MaxIntentos,
      validacion: resp.Validacion,
    },
  };
}

export type ArchivoAutofactura = "pdf" | "xml" | "qr";

/**
 * XML, PDF o QR, tal cual los sirve el PHP. Van por aquí y no como link
 * directo al host PHP para que el navegador no tenga que conocer
 * PHP_API_BASE_URL. La ruta se arma con una lista cerrada de archivos y un
 * código ya validado: no hay forma de pedir otra cosa del host PHP.
 */
export async function descargarArchivoAutofactura(
  codigo: string,
  archivo: ArchivoAutofactura
): Promise<Response | null> {
  if (!esCodigoValido(codigo)) return null;

  const path =
    archivo === "qr"
      ? `/endpoint/web/autofacturaQrWeb.php?Codigo=${codigo}&Tamano=8`
      : `/endpoint/web/autofacturaDescargaWeb.php?Codigo=${codigo}&Tipo=${archivo.toUpperCase()}`;

  return fetchPhpAsset(path);
}
