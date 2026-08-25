import { callLegacyPhpApi } from "./phpApi";
import { getSession } from "./session";

export type CatalogoBuscable = "productoServicio" | "productoServicioCartaPorte" | "claveUnidad";

export interface ResultadoProductoServicio {
  id: string;
  texto: string;
  iva_trasladado: string;
  ieps_trasladado: string;
  complemento: string;
  estimulo_frontera: string;
}

export interface ResultadoClaveUnidad {
  id: string;
  texto: string;
  simbolo: string;
}

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
