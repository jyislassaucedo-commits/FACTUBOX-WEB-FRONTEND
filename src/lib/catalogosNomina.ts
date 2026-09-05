import { callLegacyPhpApi } from "./phpApi";
import { getSession } from "./session";
import { CATALOGOS_NOMINA_VACIOS, type CatalogosNomina } from "./catalogosNominaShared";

/**
 * Trae los catorce catálogos de un viaje.
 *
 * De uno en uno serían catorce vueltas al servidor para pintar un solo
 * formulario. Juntos no llegan a mil filas: el más grande son 115 deducciones.
 */
export async function getCatalogosNomina(): Promise<CatalogosNomina> {
  const session = await getSession();
  if (!session) return CATALOGOS_NOMINA_VACIOS;

  const resp = await callLegacyPhpApi<{ Catalogos: CatalogosNomina }>(
    "/maa/mvc/CatalogoSat/api/obtenerCatalogoNominaV2.php",
    { Token: session.token, Catalogo: "todos" }
  );

  if (resp.Error !== "0") return CATALOGOS_NOMINA_VACIOS;
  return { ...CATALOGOS_NOMINA_VACIOS, ...(resp.Catalogos ?? {}) };
}

