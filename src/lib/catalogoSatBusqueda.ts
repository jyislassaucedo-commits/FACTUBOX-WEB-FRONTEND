import { callLegacyPhpApi } from "./phpApi";
import { getSession } from "./session";
import type { CatalogoBuscable, CatalogoCompleto } from "./catalogoSatBusquedaShared";

/**
 * Autocompletado contra los catálogos SAT_* cargados en la base (ver
 * public_html/maa/core/catalogosSat). Sirve tanto ClaveProdServ como
 * ClaveUnidad del paso de Conceptos - mismo endpoint, "Catalogo" decide
 * cuál tabla busca.
 */
export async function buscarCatalogoSat<T>(
  catalogo: CatalogoBuscable,
  q: string
): Promise<T[]> {
  const session = await getSession();
  if (!session) return [];
  if (q.trim().length < 3) return [];

  const resp = await callLegacyPhpApi<{ Resultados: T[] }>(
    "/maa/mvc/CatalogoSat/api/buscarCatalogoV2.php",
    { Token: session.token, Catalogo: catalogo, Q: q }
  );
  if (resp.Error !== "0") return [];
  return resp.Resultados;
}

/**
 * Catálogo completo (RegimenFiscal, UsoCFDI): son chicos, se traen enteros
 * una sola vez y el cliente filtra/busca en memoria - sin debounce ni
 * round-trip por cada letra que se escribe.
 */
export async function obtenerCatalogoSat<T>(catalogo: CatalogoCompleto): Promise<T[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Resultados: T[] }>(
    "/maa/mvc/CatalogoSat/api/obtenerCatalogoV2.php",
    { Token: session.token, Catalogo: catalogo }
  );
  if (resp.Error !== "0") return [];
  return resp.Resultados;
}
