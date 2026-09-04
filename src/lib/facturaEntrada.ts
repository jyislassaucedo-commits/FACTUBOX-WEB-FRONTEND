import type { NuevaFacturaInput, TipoComprobante } from "@/lib/timbrado";

/** Tipos de comprobante que la pantalla de nueva factura sabe armar hoy. */
export const TIPOS_SOPORTADOS: TipoComprobante[] = ["I", "E", "P"];

export type CuerpoFactura = NuevaFacturaInput & { emisorToken: string };

/**
 * Revisiones mínimas sobre el cuerpo que llega del cliente, antes de armar
 * nada.
 *
 * Vive aquí, y no dentro de cada route, porque la usan tanto la ruta que
 * timbra como la que solo valida. Si cada una llevara su copia acabarían
 * discrepando, y una validación que acepta lo que el timbrado rechaza (o al
 * revés) es justo el problema que este código existe para evitar.
 *
 * @returns el motivo del rechazo, o null si el cuerpo sirve.
 */
export function revisarEntradaFactura(body: CuerpoFactura | null): string | null {
  // Un CFDI de Pago no manda conceptos reales desde el cliente (el filler
  // "Pago" $0 lo arma buildDatosJSONPago del lado del servidor); en cambio
  // sí necesita el bloque `pago` con al menos un documento relacionado.
  const requiereConceptos = body?.tipoDeComprobante !== "P";

  if (
    !body?.emisorToken ||
    !body?.rfcEmisor ||
    (requiereConceptos && !body?.conceptos?.length) ||
    !body?.receptorRfc ||
    !body?.receptorNombre ||
    !body?.receptorRegimenFiscal ||
    !body?.receptorUsoCfdi
  ) {
    return "Faltan datos de la factura";
  }

  // El tipo llega del cliente: se valida aquí también porque JSON_CFDI40 lo
  // copia tal cual al XML y un valor raro se convierte en un rechazo del PAC
  // (con timbre consumido).
  const tipo = body.tipoDeComprobante;
  if (!tipo || !TIPOS_SOPORTADOS.includes(tipo)) {
    return "Tipo de comprobante no soportado por esta pantalla";
  }

  // Una nota de crédito sin CFDI relacionado es válida para el schema, pero
  // deja al receptor sin forma de amarrarla con su factura original.
  if (tipo === "E" && !body.cfdiRelacionados?.uuids?.length) {
    return "Una nota de crédito debe relacionar al menos un CFDI";
  }

  if (tipo === "P" && !body.pago?.doctoRelacionado?.length) {
    return "Un complemento de pago debe decir qué factura salda";
  }

  return null;
}
