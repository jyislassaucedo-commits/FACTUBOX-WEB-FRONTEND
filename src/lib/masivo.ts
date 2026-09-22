import { callLegacyPhpApi, callLegacyPhpApiFormData, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { getEmisor } from "./emisores";
import type { ItemResultado, ResumenLote } from "./masivoShared";

/**
 * Llamadas al timbrado por lotes del backend PHP.
 *
 * Solo servidor: usa la sesión, que vive en una cookie httpOnly. La página
 * habla con /api/masivo/... y esas rutas llaman a esto.
 *
 * Contrato completo en public_html/docs/API_TIMBRADO_LOTE.md.
 */

const RUTA = "/endpoint/apiTimbradoLoteV2.php";

type Fallo = { error: string };

function falloDe(r: PhpResponse<Record<string, unknown>>): string | null {
  if (r.Error === "1") {
    return (r as { DescripError?: string }).DescripError ?? "El servidor no explicó el error";
  }
  return null;
}

/** Resuelve el token del emisor y el de la sesión, o dice qué falta. */
async function credenciales(rfc: string): Promise<{ SessionToken: string; Token: string } | Fallo> {
  const sesion = await getSession();
  if (!sesion) return { error: "La sesión expiró" };

  const emisor = await getEmisor(rfc);
  if (!emisor?.Token) return { error: `No se encontró el emisor ${rfc}` };

  return { SessionToken: sesion.token, Token: emisor.Token };
}

function esFallo(x: unknown): x is Fallo {
  return typeof x === "object" && x !== null && "error" in x;
}

export type CrearLoteInput = {
  rfc: string;
  archivo: File;
  modoTimbrado: "PRUEBAS" | "PRODUCCION";
  serie?: string;
  referencia?: string;
  enviarCorreo?: boolean;
  /**
   * Sin esto, un reintento tras un corte de red crea un lote nuevo y timbra
   * todo dos veces. Si no se manda, el backend usa el hash del archivo.
   */
  claveIdempotencia?: string;
};

/**
 * Sube la plantilla. El lote queda esperando confirmación a propósito: quien
 * sube un Excel quiere ver los errores de captura antes de gastar timbres.
 */
export async function crearLoteDesdeArchivo(
  input: CrearLoteInput
): Promise<ResumenLote | Fallo> {
  const cred = await credenciales(input.rfc);
  if (esFallo(cred)) return cred;

  const fd = new FormData();
  fd.append("SessionToken", cred.SessionToken);
  fd.append("Token", cred.Token);
  fd.append("Tarea", "CREAR_ARCHIVO");
  fd.append("ModoTimbrado", input.modoTimbrado);
  fd.append("Autoarranque", "NO");
  fd.append("Archivo", input.archivo, input.archivo.name);
  if (input.serie) fd.append("Serie", input.serie);
  if (input.referencia) fd.append("Referencia", input.referencia);
  if (input.enviarCorreo) fd.append("EnviarCorreo", "SI");
  if (input.claveIdempotencia) fd.append("ClaveIdempotencia", input.claveIdempotencia);

  const r = await callLegacyPhpApiFormData<Record<string, unknown>>(RUTA, fd);
  const fallo = falloDe(r);
  return fallo ? { error: fallo } : (r as unknown as ResumenLote);
}

async function tarea(
  rfc: string,
  campos: Record<string, string>
): Promise<Record<string, unknown> | Fallo> {
  const cred = await credenciales(rfc);
  if (esFallo(cred)) return cred;

  const r = await callLegacyPhpApi<Record<string, unknown>>(RUTA, { ...cred, ...campos });
  const fallo = falloDe(r);
  return fallo ? { error: fallo } : (r as unknown as Record<string, unknown>);
}

export async function confirmarLote(rfc: string, idLote: number) {
  return tarea(rfc, { Tarea: "CONFIRMAR", IdLote: String(idLote) }) as Promise<ResumenLote | Fallo>;
}

export async function estatusLote(rfc: string, idLote: number) {
  return tarea(rfc, { Tarea: "ESTATUS", IdLote: String(idLote) }) as Promise<ResumenLote | Fallo>;
}

export async function cancelarLote(rfc: string, idLote: number) {
  return tarea(rfc, { Tarea: "CANCELAR", IdLote: String(idLote) }) as Promise<ResumenLote | Fallo>;
}

export async function reintentarLote(rfc: string, idLote: number) {
  return tarea(rfc, { Tarea: "REINTENTAR", IdLote: String(idLote) }) as Promise<ResumenLote | Fallo>;
}

export type PaginaResultados = {
  IdLote: number;
  Total: number;
  Devueltos: number;
  /** El último índice leído. Se pasa como Desde para pedir el siguiente tramo. */
  SiguienteDesde: number | null;
  Items: ItemResultado[];
};

export async function resultadosLote(
  rfc: string,
  idLote: number,
  filtro = "TODOS",
  desde = 0,
  limite = 200
) {
  return tarea(rfc, {
    Tarea: "RESULTADOS",
    IdLote: String(idLote),
    Filtro: filtro,
    Desde: String(desde),
    Limite: String(limite),
  }) as Promise<PaginaResultados | Fallo>;
}

export async function listarLotes(rfc: string, limite = 15) {
  return tarea(rfc, { Tarea: "LISTAR", Limite: String(limite) }) as Promise<
    { Lotes: ResumenLote[] } | Fallo
  >;
}

/** La plantilla vacía, para que el usuario no tenga que buscarla. */
export async function plantillaVacia(rfc: string, tipo: string, layout: string) {
  return tarea(rfc, { Tarea: "PLANTILLA", Tipo: tipo, Layout: layout }) as Promise<
    { NombreArchivo: string; Archivo_Base64: string; SeAceptaEnCrearArchivo: string } | Fallo
  >;
}

/** El reporte de resultados, o el paquete de comprobantes. */
export async function descargaLote(
  rfc: string,
  idLote: number,
  que: "REPORTE" | "PAQUETE",
  incluirPdf = false
) {
  const campos: Record<string, string> =
    que === "REPORTE"
      ? { Tarea: "REPORTE", IdLote: String(idLote), Formato: "BASE64" }
      : {
          Tarea: "DESCARGAR",
          IdLote: String(idLote),
          Formato: "ZIP",
          // El backend contesta el binario por omisión; desde el BFF conviene
          // el JSON, que se puede revisar antes de reenviarlo al navegador.
          Base64: "SI",
          IncluirPdf: incluirPdf ? "SI" : "NO",
        };

  return tarea(rfc, campos) as Promise<
    { NombreArchivo: string; Archivo_Base64: string; SiguienteDesde?: number | null } | Fallo
  >;
}

export type { ResumenLote, ItemResultado };
