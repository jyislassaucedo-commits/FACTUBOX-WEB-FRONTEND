import type { PillTone } from "@/components/ui/styles";
import { TIPO_LABELS } from "@/lib/reportesUtils";

/* ---------------------------------------------------------------------------
   Estructura de navegacion de un emisor.
   ---------------------------------------------------------------------------
   Fuente unica: la usa el sidebar contextual (EmisorNav) y el dropdown
   "Emisores" de la barra superior (AppShell). Agregar una seccion nueva del
   emisor = agregar una entrada aqui + su page.tsx.
--------------------------------------------------------------------------- */

export type EmisorSectionKey =
  | "resumen"
  | "datos"
  | "csd"
  | "series"
  | "receptores"
  | "empleados"
  | "nomina"
  | "disenos";

export type EmisorSection = {
  key: EmisorSectionKey;
  /** Segmento de URL relativo a /emisores/[rfc]. "" = la propia raiz. */
  segment: string;
  label: string;
  /** Texto corto para el dropdown de la barra superior. */
  description: string;
  group: "emisor" | "catalogos" | "operacion";
};

export const EMISOR_SECTIONS: EmisorSection[] = [
  {
    key: "resumen",
    segment: "",
    label: "Resumen",
    description: "Estado de configuración del emisor",
    group: "emisor",
  },
  {
    key: "datos",
    segment: "datos",
    label: "Datos generales",
    description: "RFC, razón social, régimen y logo",
    group: "emisor",
  },
  {
    key: "csd",
    segment: "csd",
    label: "Certificado (CSD)",
    description: "Sello digital y su vigencia",
    group: "emisor",
  },
  {
    key: "series",
    segment: "series",
    label: "Series y folios",
    description: "Consecutivos por tipo de comprobante",
    group: "catalogos",
  },
  {
    key: "receptores",
    segment: "receptores",
    label: "Receptores",
    description: "Clientes frecuentes para facturar",
    group: "catalogos",
  },
  {
    key: "empleados",
    segment: "empleados",
    label: "Empleados",
    description: "Plantilla para los recibos de nómina",
    group: "catalogos",
  },
  {
    key: "nomina",
    segment: "nomina",
    label: "Nómina",
    description: "Corre y timbra la nómina del periodo",
    group: "operacion",
  },
  {
    key: "disenos",
    segment: "disenos",
    label: "Diseños PDF",
    description: "Plantillas del PDF de facturas",
    group: "catalogos",
  },
];

export function emisorHref(rfc: string, segment: string) {
  const base = `/emisores/${encodeURIComponent(rfc)}`;
  return segment ? `${base}/${segment}` : base;
}

/** Deduce la seccion activa a partir del pathname completo. */
export function activeSection(pathname: string, rfc: string): EmisorSectionKey | null {
  const base = `/emisores/${encodeURIComponent(rfc)}`;
  if (!pathname.startsWith(base)) return null;
  const rest = pathname.slice(base.length).replace(/^\//, "").split("/")[0] ?? "";
  const found = EMISOR_SECTIONS.find((s) => s.segment === rest);
  return found?.key ?? null;
}

/* ---------------------------------------------------------------------------
   Helpers de presentacion compartidos
--------------------------------------------------------------------------- */

const TIPO_TONE: Record<string, PillTone> = {
  I: "ok",
  E: "danger",
  N: "violet",
  P: "info",
  T: "teal",
};

/** Tipos de comprobante que el SAT reconoce (los demas son basura heredada). */
export function tipoSerie(tipo: string): { label: string; tone: PillTone; valido: boolean } {
  const label = TIPO_LABELS[tipo];
  if (!label) {
    return { label: tipo || "sin tipo", tone: "warn", valido: false };
  }
  return { label, tone: TIPO_TONE[tipo] ?? "neutral", valido: true };
}

/**
 * El backend devuelve la vigencia como "YYYY-MM-DD HH:MM:SS". Se parsea a mano
 * porque `new Date("2027-05-18 11:43:51")` no es estandar y Safari lo rechaza.
 */
export function parseVigencia(valor: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/.exec(valor?.trim() ?? "");
  if (!m) return null;
  const fecha = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4] ?? 0),
    Number(m[5] ?? 0),
    Number(m[6] ?? 0)
  );
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function diasRestantes(vigencia: string, ahora = new Date()): number | null {
  const fecha = parseVigencia(vigencia);
  if (!fecha) return null;
  return Math.ceil((fecha.getTime() - ahora.getTime()) / 86_400_000);
}

export function formatoFecha(valor: string): string {
  const fecha = parseVigencia(valor);
  if (!fecha) return valor || "—";
  return fecha.toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Iniciales para los avatares de receptor / emisor. */
export function iniciales(nombre: string, max = 2): string {
  return (
    nombre
      .trim()
      .split(/\s+/)
      .filter((p) => p.length > 1)
      .slice(0, max)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}
