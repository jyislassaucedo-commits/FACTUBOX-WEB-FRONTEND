/* ---------------------------------------------------------------------------
   Tipos y catálogos de facturas seguros para importar desde componentes
   cliente: aquí NO se importa session.ts / next/headers.
   `facturas.ts` (que sí llama al backend) importa de este archivo, no al revés.
   Mismo patrón que `configPdfShared.ts`.
--------------------------------------------------------------------------- */

/** Fila del listado tal como la devuelve getFacturasV2.php. */
export type Factura = {
  Rfc: string; // RFC del emisor
  Nombre: string; // razón social del emisor
  Version: string;
  Uuid: string;
  EstatusSat: string; // "Vigente" | "Cancelado" | "No Encontrado" | ""
  RfcReceptor: string;
  NombreReceptor: string;
  RegimenReceptor: string;
  DomicilioReceptor: string;
  Serie: string;
  Folio: string;
  TipoComprobante: string; // I | E | N | P | T
  FormaPago: string;
  MetodoPago: string;
  Total: string;
  Moneda: string;
  FechaEmision: string;
  FechaTimbrado: string;
  FechaCancelacion: string;
  RfcProvCertif: string;
  Detalles: string;
  NombreUsuario: string;
  CorreoUsuario: string;
  IdConfigPdf: string;
  FechaReg: string;
};

export type FacturasFiltros = {
  /** RFC del emisor. "" = todos los emisores del usuario. */
  emisor: string;
  /** "TODO" o un TipoDeComprobante (I/E/N/P/T). */
  tipo: string;
  /** "TODO" | "Vigente" | "Cancelado". */
  estatus: string;
  /** YYYY-MM-DD */
  desde: string;
  /** YYYY-MM-DD */
  hasta: string;
};

/** Catálogo c_MotivoCancelacion del SAT. */
export const MOTIVOS_CANCELACION = [
  {
    value: "01",
    label: "01 - Comprobante emitido con errores con relación",
    requiereSustitucion: true,
    ayuda:
      "La factura tiene errores y ya emitiste otra que la sustituye. Necesitas el UUID de la sustituta.",
  },
  {
    value: "02",
    label: "02 - Comprobante emitido con errores sin relación",
    requiereSustitucion: false,
    ayuda: "La factura tiene errores y no habrá una que la sustituya.",
  },
  {
    value: "03",
    label: "03 - No se llevó a cabo la operación",
    requiereSustitucion: false,
    ayuda: "La venta o el servicio nunca ocurrió.",
  },
  {
    value: "04",
    label: "04 - Operación nominativa relacionada en factura global",
    requiereSustitucion: false,
    ayuda: "La operación ya quedó incluida en una factura global.",
  },
] as const;
