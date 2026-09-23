/* ---------------------------------------------------------------------------
   Estructura de navegación de Facturas.
   ---------------------------------------------------------------------------
   Espejo de emisorNav.ts, y por el mismo motivo: fuente única para el lateral
   (FacturasNav) y para el botón dividido de "Nueva". Agregar una sección =
   agregar una entrada aquí + su page.tsx.

   Facturas es todo lo que se EMITE. Antes estaba repartido: las facturas aquí,
   y nómina, timbrado masivo y autofacturas dentro de la ficha del emisor, que
   es donde se configura. Un recibo de nómina y una factura masiva son
   comprobantes igual que una factura suelta, y acaban en la misma lista.
--------------------------------------------------------------------------- */

export type FacturasSectionKey = "todas" | "nomina" | "lotes" | "autofacturas";

export type FacturasSection = {
  key: FacturasSectionKey;
  /** Segmento relativo a /facturas. "" = la propia lista. */
  segment: string;
  label: string;
  /** Texto corto para los menús. */
  description: string;
  /**
   * Si emite comprobantes. Las que emiten necesitan un emisor concreto: con
   * "todos los emisores" activo no se puede, porque un CFDI sale de uno.
   */
  emite: boolean;
};

export const FACTURAS_SECTIONS: FacturasSection[] = [
  {
    key: "todas",
    segment: "",
    label: "Todas",
    description: "Lo que ya emitiste, de cualquier tipo",
    emite: false,
  },
  {
    key: "nomina",
    segment: "nomina",
    label: "Nómina",
    description: "Corridas por periodo, prenóminas y recibos",
    emite: true,
  },
  {
    key: "lotes",
    segment: "lotes",
    label: "Lotes",
    description: "Plantillas de Excel timbradas en bloque",
    emite: true,
  },
  {
    key: "autofacturas",
    segment: "autofacturas",
    label: "Autofacturas",
    description: "Enlaces y QR que llenan tus clientes",
    emite: true,
  },
];

export function facturasHref(segment: string) {
  return segment ? `/facturas/${segment}` : "/facturas";
}

/**
 * Qué sección del lateral está activa.
 *
 * A diferencia de activeSection() de emisorNav, aquí no hace falta el rfc: el
 * emisor ya no viaja en la dirección. /facturas/nueva no es una sección del
 * lateral, así que devuelve null y no se marca nada — es correcto, se llega por
 * el botón.
 */
export function seccionActiva(pathname: string): FacturasSectionKey | null {
  if (!pathname.startsWith("/facturas")) return null;
  const resto = pathname.slice("/facturas".length).replace(/^\//, "").split("/")[0] ?? "";
  if (resto === "" ) return "todas";
  const encontrada = FACTURAS_SECTIONS.find((s) => s.segment === resto);
  return encontrada?.key ?? null;
}
