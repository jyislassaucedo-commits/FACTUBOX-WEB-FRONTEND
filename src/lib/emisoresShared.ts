/* ---------------------------------------------------------------------------
   Estatus del emisor: tipos y helpers SIN "use server".
   ---------------------------------------------------------------------------
   Viven aparte de lib/emisores.ts porque ese modulo importa getSession()
   (next/headers) y es solo de servidor; el listado y las tarjetas son
   componentes de cliente y necesitan estos helpers. Mismo motivo que
   configPdfShared.ts y perfilShared.ts.
--------------------------------------------------------------------------- */

/**
 * Valores de EMPRESA.status.
 *
 * "ACTIVADO" es el que escribe setEmpresaV2.php al dar de alta, y contra el que
 * ya comparaba el listado. No se inventa un tercer valor ni se normaliza la
 * columna: eso obligaria a una migracion sobre datos que tambien lee la app de
 * escritorio.
 */
export const EMISOR_ACTIVADO = "ACTIVADO";
export const EMISOR_DESACTIVADO = "DESACTIVADO";

export type EstatusEmisor = typeof EMISOR_ACTIVADO | typeof EMISOR_DESACTIVADO;

/**
 * Un emisor cuenta como activo solo si dice exactamente "ACTIVADO".
 *
 * La comparacion es contra el valor activo y no contra el desactivado a
 * proposito: en la base hay filas viejas con status vacio o con variantes de
 * escritura, y ante la duda conviene tratarlas como NO activas. Un emisor que
 * aparece de mas en el listado se corrige con un clic; uno con el que se timbra
 * sin querer, no.
 */
export function emisorEstaActivo(estatus: string | null | undefined): boolean {
  return (estatus ?? "").trim().toUpperCase() === EMISOR_ACTIVADO;
}

/** Etiqueta legible para la pastilla del listado y las tarjetas. */
export function etiquetaEstatusEmisor(estatus: string | null | undefined): string {
  if (emisorEstaActivo(estatus)) return "Activo";
  const valor = (estatus ?? "").trim();
  return valor === "" ? "Sin estatus" : "Desactivado";
}
