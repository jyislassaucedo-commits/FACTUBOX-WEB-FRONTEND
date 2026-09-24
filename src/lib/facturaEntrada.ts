import type { NuevaFacturaInput, TipoComprobante } from "@/lib/timbrado";
import { MONEDAS } from "@/lib/catalogosSat";
import { complementoDe, problemasDeComplementos } from "@/lib/complementos";
import { EXPORTACIONES, OBSERVACIONES_MAX, PERIODICIDADES, mesesPara } from "@/lib/facturaNueva";

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

  if (tipo === "P") {
    const pagos = body.pagos ?? (body.pago ? [body.pago] : []);
    if (pagos.length === 0) return "Un complemento de pago debe llevar al menos un pago";
    for (const p of pagos) {
      if (!p.doctoRelacionado?.length) return "Cada pago debe decir qué facturas salda";
      if (!(parseFloat(p.monto) > 0)) return "Cada pago debe tener un monto mayor a 0";
      if (p.monedaP !== "MXN" && !(parseFloat(p.tipoCambioP) > 0)) return "Falta el tipo de cambio de un pago";
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(p.fechaPago)) return "La fecha de un pago no tiene el formato correcto";
      for (const d of p.doctoRelacionado) {
        if (!UUID.test(d.idDocumento)) return "Una factura pagada tiene un folio fiscal inválido";
        if (parseFloat(d.impPagado) - parseFloat(d.impSaldoAnt) > 0.01) return "Se paga más que el saldo de una factura";
      }
    }
  }

  // Lo que el asistente puede cambiar además de lo de siempre. Todo va tal
  // cual al XML, así que un valor raro aquí es un rechazo del PAC con el
  // timbre ya consumido.
  if (body.fecha !== undefined && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(body.fecha)) {
    return "La fecha de emisión no tiene el formato correcto";
  }
  if (body.moneda !== undefined && !MONEDAS.some((m) => m.value === body.moneda)) {
    return "Moneda no soportada";
  }
  if (body.moneda && body.moneda !== "MXN" && !(parseFloat(body.tipoCambio ?? "") > 0)) {
    return "Falta el tipo de cambio de la moneda";
  }
  if (body.exportacion !== undefined && !EXPORTACIONES.some((e) => e.value === body.exportacion)) {
    return "Clave de exportación no válida";
  }
  if (body.informacionGlobal) {
    const g = body.informacionGlobal;
    if (
      !PERIODICIDADES.some((p) => p.value === g.periodicidad) ||
      !mesesPara(g.periodicidad).some((m) => m.value === g.meses) ||
      !/^\d{4}$/.test(g.anio)
    ) {
      return "La información global está incompleta";
    }
  }
  if (body.cfdiRelacionados?.uuids?.some((u) => !UUID.test(u.trim()))) {
    return "Hay un folio fiscal relacionado con formato inválido";
  }
  if ((body.observaciones ?? "").length > OBSERVACIONES_MAX) {
    return `Las observaciones pueden tener hasta ${OBSERVACIONES_MAX} caracteres`;
  }
  if (body.complementos) {
    for (const id of Object.keys(body.complementos)) {
      const def = complementoDe(id);
      if (!def || !def.disponible) return `Complemento no soportado: ${id}`;
    }
    const faltan = problemasDeComplementos(body.complementos);
    if (faltan.length > 0) return faltan[0].mensaje;
  }

  return null;
}

const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
