// Tipos y funciones puras de los catálogos SAT_* - sin imports de servidor
// (session/next-headers), así que los pueden usar tanto componentes cliente
// como server. La búsqueda en sí (que sí necesita la sesión) vive en
// catalogoSatBusqueda.ts.

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

export type CatalogoCompleto = "regimenFiscal" | "usoCfdi";

export interface ResultadoRegimenFiscal {
  id: string;
  texto: string;
  aplica_fisica: string;
  aplica_moral: string;
}

export interface ResultadoUsoCfdi {
  id: string;
  texto: string;
  aplica_fisica: string;
  aplica_moral: string;
  /** Claves de RegimenFiscal separadas por coma con las que este uso es válido. */
  regimenes_fiscales_receptores: string;
}

/** RFC de 13 caracteres = persona física, de 12 = persona moral. */
export function esPersonaFisica(rfc: string): boolean {
  return rfc.trim().length === 13;
}

/** Filtra un catálogo con aplica_fisica/aplica_moral según el RFC del receptor/emisor. */
export function aplicaPorRfc<T extends { aplica_fisica: string; aplica_moral: string }>(
  opciones: T[],
  rfc: string
): T[] {
  if (!rfc.trim()) return opciones;
  const campo = esPersonaFisica(rfc) ? "aplica_fisica" : "aplica_moral";
  return opciones.filter((o) => o[campo] === "1");
}

/** Usos de CFDI válidos para un RegimenFiscal dado (el SAT rechaza el CFDI si no coinciden). */
export function usosCompatibles(
  usos: ResultadoUsoCfdi[],
  regimenFiscal: string
): ResultadoUsoCfdi[] {
  if (!regimenFiscal) return usos;
  return usos.filter((u) =>
    u.regimenes_fiscales_receptores
      .split(",")
      .map((r) => r.trim())
      .includes(regimenFiscal)
  );
}
