/**
 * Tipos y ayudas del timbrado por lotes que usan LOS DOS lados.
 *
 * Va aparte de masivo.ts porque ese importa la sesión, que solo existe en el
 * servidor: si la página lo importara para usar un tipo, Next arrastraría el
 * módulo entero al navegador. Misma separación que emisoresShared / perfilShared.
 */

export type EstadoLote =
  | "REVISION"
  | "PENDIENTE"
  | "PROCESANDO"
  | "FINALIZADO"
  | "CANCELADO"
  | "ATORADO";

export type EstadoItem =
  | "PENDIENTE"
  | "PROCESANDO"
  | "TIMBRADO"
  | "FALLADO"
  | "INVALIDO"
  | "CANCELADO"
  | "REVISION_MANUAL";

export type ErrorCelda = {
  Hoja: string | null;
  Fila: number | null;
  Columna: string | null;
  Celda: string | null;
  Valor: string;
  Mensaje: string;
};

export type ResumenLote = {
  IdLote: number;
  Codigo: string;
  Tipo: string;
  Layout: string | null;
  Origen: string;
  Referencia: string | null;
  Estado: EstadoLote;
  Motor: string | null;
  Total: number;
  Timbrados: number;
  Fallados: number;
  Invalidos: number;
  Cancelados: number;
  Pendientes: number;
  Avance: string;
  FechaAlta: string | null;
  FechaInicio: string | null;
  FechaFin: string | null;
  SegundosSinLatido: number | null;
  EstimadoSegundos: number | null;
  Mensaje: string;
  /** Solo al crear. */
  Validos?: number;
  Items?: ItemCreado[];
  ErroresArchivo?: ErrorCelda[];
  Repetido?: string;
  Aviso?: string;
};

export type ItemCreado = {
  Indice: number;
  UUIDLocal: string;
  Referencia: string | null;
  Hoja?: string | null;
  Fila?: number | null;
  Estado: EstadoItem;
  Errores: ErrorCelda[];
};

export type ItemResultado = {
  Indice: number;
  Referencia: string | null;
  Hoja: string | null;
  Fila: number | null;
  Etiqueta: string | null;
  Serie: string | null;
  Folio: string | null;
  RfcReceptor: string | null;
  Total: string;
  Moneda: string;
  UUIDLocal: string;
  Estado: EstadoItem;
  Intentos: number;
  UUID: string | null;
  IdFactura: number | null;
  FechaTimbrado: string | null;
  CorreoEstado: string | null;
  DescripError: string;
  Errores: ErrorCelda[];
};

export const TIPOS_LOTE = [
  { valor: "PREFACTURA", etiqueta: "Facturas" },
  { valor: "NOMINA", etiqueta: "Nómina" },
  { valor: "PAGO", etiqueta: "Complementos de pago" },
] as const;

/** Un lote sigue vivo mientras pueda cambiar solo. */
export function loteEnCurso(estado: EstadoLote) {
  return estado === "PENDIENTE" || estado === "PROCESANDO";
}

/**
 * Qué decirle al usuario de cada estado.
 *
 * FINALIZADO es el que más se malinterpreta: quiere decir que el lote terminó,
 * no que todo salió bien. Por eso el texto no dice "listo" a secas.
 */
export function textoEstadoLote(estado: EstadoLote): { texto: string; tono: "info" | "ok" | "warn" | "danger" } {
  switch (estado) {
    case "REVISION":
      return { texto: "Esperando que lo confirmes", tono: "info" };
    case "PENDIENTE":
      return { texto: "En cola", tono: "info" };
    case "PROCESANDO":
      return { texto: "Timbrando", tono: "info" };
    case "FINALIZADO":
      return { texto: "Terminado", tono: "ok" };
    case "CANCELADO":
      return { texto: "Cancelado", tono: "warn" };
    case "ATORADO":
      return { texto: "Se atoró", tono: "danger" };
  }
}

export function textoEstadoItem(estado: EstadoItem): { texto: string; tono: "neutral" | "ok" | "warn" | "danger" } {
  switch (estado) {
    case "TIMBRADO":
      return { texto: "Timbrado", tono: "ok" };
    case "FALLADO":
      return { texto: "Rechazado", tono: "danger" };
    case "INVALIDO":
      return { texto: "Error de captura", tono: "warn" };
    case "REVISION_MANUAL":
      return { texto: "Revisar a mano", tono: "danger" };
    case "CANCELADO":
      return { texto: "Cancelado", tono: "neutral" };
    case "PROCESANDO":
      return { texto: "Timbrando", tono: "neutral" };
    default:
      return { texto: "Pendiente", tono: "neutral" };
  }
}

/** "2 min 30 s", para el tiempo que falta. */
export function duracion(segundos: number | null): string | null {
  if (segundos === null || segundos < 0) return null;
  if (segundos < 60) return `${Math.round(segundos)} s`;
  const min = Math.floor(segundos / 60);
  const seg = Math.round(segundos % 60);
  return seg === 0 ? `${min} min` : `${min} min ${seg} s`;
}

/**
 * Cada cuánto volver a preguntar por el avance.
 *
 * Se espacía conforme el lote se alarga: un lote de dos mil tarda minutos y
 * preguntar cada dos segundos durante todo ese rato son cientos de peticiones
 * para pintar una barra que se mueve despacio.
 */
export function intervaloSondeo(segundosCorriendo: number): number {
  if (segundosCorriendo < 30) return 2000;
  if (segundosCorriendo < 120) return 4000;
  return 8000;
}
