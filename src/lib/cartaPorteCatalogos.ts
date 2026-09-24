import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import type { EntidadCP, PaginaCP, RegistroCP } from "./cartaPorteShared";

/*
   Catálogos de carta porte en la nube (maa/mvc/CartaPorte/api/*CatalogoCartaPorteV2).
   El servidor valida que el emisor sea del usuario y guarda el árbol completo
   de cada registro (el transporte con su medio, remolques, contenedores...).
*/

const BASE = "/maa/mvc/CartaPorte/api";

function b64(v: unknown) {
  return Buffer.from(JSON.stringify(v)).toString("base64");
}

export async function listarCatalogoCP<T extends RegistroCP>(
  rfcEmisor: string,
  entidad: EntidadCP,
  { q = "", pagina = 1, por = 50 }: { q?: string; pagina?: number; por?: number } = {}
): Promise<PaginaCP<T> | null> {
  const session = await getSession();
  if (!session) return null;
  const resp = await callLegacyPhpApi<{ Total: number; Registros: T[] }>(`${BASE}/getCatalogosCartaPorteV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Entidad: entidad,
    Q: q,
    Pagina: String(pagina),
    Por: String(por),
  });
  if (resp.Error !== "0") return null;
  return { total: resp.Total ?? 0, registros: resp.Registros ?? [] };
}

export async function obtenerRegistroCP<T extends RegistroCP>(
  rfcEmisor: string,
  entidad: EntidadCP,
  id: number
): Promise<PhpResponse<{ Registro: T }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Registro: T }>(`${BASE}/getCatalogoCartaPorteV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Entidad: entidad,
    Id: String(id),
  });
}

export async function guardarRegistroCP<T extends RegistroCP>(
  rfcEmisor: string,
  entidad: EntidadCP,
  registro: T
): Promise<PhpResponse<{ Id: number; Registro: T }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Id: number; Registro: T }>(`${BASE}/setCatalogoCartaPorteV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Entidad: entidad,
    DatosJSON: b64(registro),
  });
}

export async function borrarRegistroCP(
  rfcEmisor: string,
  entidad: EntidadCP,
  id: number
): Promise<PhpResponse<{ Id: number }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Id: number }>(`${BASE}/deleteCatalogoCartaPorteV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    Entidad: entidad,
    Id: String(id),
  });
}

/** Tanda de mercancías al catálogo, sin duplicar (importación de Excel). Hasta 1000. */
export async function guardarMercanciasCP(
  rfcEmisor: string,
  filas: Array<Record<string, string>>
): Promise<PhpResponse<{ Recibidas: number; Nuevas: number }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Recibidas: number; Nuevas: number }>(`${BASE}/guardarMercanciasCartaPorteV2.php`, {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    DatosJSON: b64({ Filas: filas }),
  });
}

/* -------------------------------------------------------------------------- */
/* Catálogos del SAT de carta porte (maa/mvc/CatalogoSat/api)                  */
/* -------------------------------------------------------------------------- */

export type FilaSat = { id: string; texto?: string; [columna: string]: string | undefined };

export async function listarTablaSat(tabla: string): Promise<PhpResponse<{ Filas: FilaSat[] }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Filas: FilaSat[] }>("/maa/mvc/CatalogoSat/api/listarCatalogoV2.php", {
    Token: session.token,
    Tabla: tabla,
  });
}

export async function buscarTablaSat(
  tabla: string,
  q: string,
  claveTransporte?: string
): Promise<PhpResponse<{ Resultados: FilaSat[] }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi<{ Resultados: FilaSat[] }>("/maa/mvc/CatalogoSat/api/buscarTablaCatalogoV2.php", {
    Token: session.token,
    Tabla: tabla,
    Q: q,
    ClaveTransporte: claveTransporte ?? "",
  });
}

export type CodigoPostalSat = {
  id: string;
  estado: string;
  estado_texto: string | null;
  municipio: string;
  municipio_texto: string | null;
  localidad: string;
  localidad_texto: string | null;
};

export async function consultarCodigoPostal(
  cp: string
): Promise<PhpResponse<{ CodigoPostal: CodigoPostalSat | null; Colonias: Array<{ id: string; texto: string }> }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi("/maa/mvc/CatalogoSat/api/codigoPostalV2.php", { Token: session.token, CodigoPostal: cp });
}

export async function existenClavesSat(
  claves: Record<string, string[]>,
  extra: Record<string, string[]> = {}
): Promise<PhpResponse<{ Existen: Record<string, Record<string, FilaSat>> }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };
  return callLegacyPhpApi("/maa/mvc/CatalogoSat/api/existenClavesV2.php", {
    Token: session.token,
    DatosJSON: b64({ Claves: claves, Extra: extra }),
  });
}
