// Tipos de la autofactura por QR, sin imports de servidor: los usan tanto la
// página pública (cliente) como las rutas BFF.
//
// La autofactura es una venta que un integrador (punto de venta, app externa)
// dejó en Factubox sin receptor. El comprador llega a /f/{codigo} desde el QR
// del ticket o desde el correo, captura sus datos fiscales y se timbra ahí.

import type { ResultadoRegimenFiscal, ResultadoUsoCfdi } from "./catalogoSatBusquedaShared";

export type EstadoAutofactura = "PENDIENTE" | "TIMBRADA" | "EXPIRADA" | "CANCELADA";

export interface ConceptoResumen {
  Descripcion: string;
  Cantidad: string;
  Unidad: string;
  ValorUnitario: string;
  Importe: string;
}

export interface ResumenAutofactura {
  Conceptos: ConceptoResumen[];
  SubTotal: string;
  Descuento: string;
  Impuestos: string;
  Total: string;
  Moneda: string;
  Serie: string;
  Folio: string;
}

/** Lo que responde autofacturaConsultarWeb.php. */
export interface Autofactura {
  Codigo: string;
  Estado: EstadoAutofactura;
  Expira: string;
  Referencia: string;
  Emisor: { Nombre: string; Rfc: string };
  Resumen: ResumenAutofactura;
  /** Enmascarado (j***@dominio): es lo único que la página pública muestra. */
  EmailSugerido: string;
  Intentos: number;
  MaxIntentos: number;
  /** Solo mientras está PENDIENTE: lo que el formulario necesita para los selectores. */
  Catalogos?: {
    RegimenFiscal: ResultadoRegimenFiscal[];
    UsoCfdi: ResultadoUsoCfdi[];
  };
  /** Solo cuando ya está TIMBRADA. */
  UUID?: string;
  FechaTimbrado?: string;
}

/** Lo que captura el comprador. */
export interface DatosReceptorAutofactura {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  usoCfdi: string;
  email: string;
}

/** Respuesta de la ruta POST /api/publico/autofactura/[codigo]. */
export interface ResultadoTimbradoAutofactura {
  UUID: string;
  FechaTimbrado: string;
  CorreoEnviado: "SI" | "NO";
  Email: string;
}

/** Error de la misma ruta: el mensaje y, si aplica, el detalle por campo. */
export interface ErrorTimbradoAutofactura {
  error: string;
  /** Estado que reportó el backend (p. ej. ya TIMBRADA por otro envío). */
  estado?: EstadoAutofactura;
  campos?: Partial<Record<keyof DatosReceptorAutofactura, string>>;
  intentos?: number;
  maxIntentos?: number;
  /** Hallazgos del validador previo al PAC, si fue eso lo que frenó. */
  validacion?: {
    Errores: { campo: string; mensaje: string }[];
    Advertencias: { campo: string; mensaje: string }[];
  };
}

/** Los campos del formulario, en el orden en que los devuelve el backend. */
export const CAMPOS_BACKEND: Record<string, keyof DatosReceptorAutofactura> = {
  Rfc: "rfc",
  Nombre: "nombre",
  RegimenFiscal: "regimenFiscal",
  DomicilioFiscal: "domicilioFiscal",
  UsoCFDI: "usoCfdi",
  Email: "email",
};

export function formatoDinero(monto: string | number, moneda = "MXN"): string {
  const n = typeof monto === "number" ? monto : parseFloat(monto || "0");
  const cifra = "$" + n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return moneda ? `${cifra} ${moneda}` : cifra;
}

export function formatoFechaLarga(fecha: string): string {
  // "2026-09-30 23:59:59" -> "30 de septiembre de 2026". Se parte a mano
  // para no depender de cómo interprete el navegador un string sin zona.
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(fecha);
  if (!m) return fecha;
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
    "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${parseInt(m[3], 10)} de ${meses[parseInt(m[2], 10) - 1]} de ${m[1]}`;
}
