/* ---------------------------------------------------------------------------
   Estado y validación del asistente de nueva factura.
   ---------------------------------------------------------------------------
   SIN "use client" y sin dependencias de servidor: lo importan tanto los
   componentes del asistente como (potencialmente) las rutas API, y así la
   validación de la UI y la del servidor pueden ser literalmente la misma.

   La validación es una función pura del borrador → lista de problemas. Nada de
   estado interno ni de efectos: por eso puede correr en cada tecleo sin costo
   y alimentar el indicador "en vivo" de cada paso.
--------------------------------------------------------------------------- */

import type {
  ConceptoInput,
  DoctoRelacionadoInput,
  ImpuestoPagoInput,
  TipoComprobante,
} from "@/lib/timbrado";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
import type { ImpuestoOrigen, PagoPrevio } from "@/lib/facturasShared";
import { IMPUESTO_IVA, RECEPTOR_PUBLICO_GENERAL } from "@/lib/catalogosSat";

export const RFC_PUBLICO_GENERAL = RECEPTOR_PUBLICO_GENERAL.Rfc;

/* -------------------------------------------------------------------------- */
/* Tipos de comprobante                                                       */
/* -------------------------------------------------------------------------- */

export type OpcionTipo = {
  value: string;
  label: string;
  resumen: string;
  detalle: string;
  disponible: boolean;
  /** Por qué todavía no se puede emitir desde aquí. */
  motivo?: string;
  /**
   * Para los que SÍ se pueden emitir, pero no desde este asistente.
   * `segmento` es relativo a /emisores/<rfc>.
   *
   * La distinción importa: "Próximamente" y "está en otra pantalla" se ven
   * igual de deshabilitados, pero uno significa que no existe y el otro que el
   * usuario está en el lugar equivocado. Decir lo primero cuando es lo segundo
   * hace que alguien concluya que la función no está.
   */
  hechoEn?: { etiqueta: string; segmento: string };
};

export const TIPOS_COMPROBANTE: OpcionTipo[] = [
  {
    value: "I",
    label: "Ingreso",
    resumen: "Factura de venta",
    detalle:
      "Lo normal: cobras por un producto o un servicio. Suma a tus ingresos del periodo.",
    disponible: true,
  },
  {
    value: "E",
    label: "Egreso",
    resumen: "Nota de crédito",
    detalle:
      "Corrige o descuenta una factura que ya emitiste: devoluciones, bonificaciones o un error en el monto.",
    disponible: true,
  },
  {
    value: "P",
    label: "Pago",
    resumen: "Complemento de pago",
    detalle:
      "Para facturas PPD, cuando el cliente abona. Trae el complemento de recepción de pagos.",
    disponible: true,
  },
  {
    value: "N",
    label: "Nómina",
    resumen: "Recibo de nómina",
    detalle: "Pago a empleados, con percepciones, deducciones e incidencias.",
    disponible: false,
    // No se emite de una en una: la nómina se corre por periodo -- se le
    // calcula a todos los empleados que entran y se timbran juntos -- y eso no
    // cabe en un asistente que arma un solo comprobante.
    motivo:
      "Se corre por periodo, no de una en una: se le calcula a todos los empleados y se timbran juntos.",
    hechoEn: { etiqueta: "Ir a Nómina", segmento: "nomina" },
  },
  {
    value: "T",
    label: "Traslado",
    resumen: "Movimiento de mercancía",
    detalle: "Mueves mercancía sin que haya venta. Suele llevar carta porte.",
    disponible: false,
    motivo: "Necesita carta porte, que aún no está en esta pantalla.",
  },
];

/** Catálogo c_TipoRelacion del SAT (los que aplican a una nota de crédito). */
export const TIPOS_RELACION = [
  { value: "01", label: "01 - Nota de crédito de los documentos relacionados" },
  { value: "02", label: "02 - Nota de débito de los documentos relacionados" },
  { value: "03", label: "03 - Devolución de mercancía sobre facturas previas" },
  { value: "04", label: "04 - Sustitución de los CFDI previos" },
  { value: "07", label: "07 - CFDI por aplicación de anticipo" },
] as const;

/* -------------------------------------------------------------------------- */
/* Borrador                                                                   */
/* -------------------------------------------------------------------------- */

export type FacturaBorrador = {
  tipo: TipoComprobante;
  relacion: { tipoRelacion: string; uuids: string[] };
  rfcEmisor: string;
  serie: string;
  folio: string;
  formaPago: string;
  metodoPago: string;
  condicionesDePago: string;
  receptorRfc: string;
  usoCfdi: string;
  conceptos: ConceptoInput[];
  /** Solo para tipo "P". */
  pago: PagoBorrador;
};

/** La factura PPD que se va a pagar, con lo que su complemento necesita
 * tomar prestado de ella (receptor e impuestos, para prorratear en pagos
 * parciales). */
export type FacturaOrigenPago = {
  uuid: string;
  serie: string;
  folio: string;
  total: string;
  moneda: string;
  rfcReceptor: string;
  nombreReceptor: string;
  regimenFiscalReceptor: string;
  domicilioFiscalReceptor: string;
  traslados: ImpuestoOrigen[];
  retenciones: ImpuestoOrigen[];
};

/** Lo que devolvió el backend al buscar pagos ya timbrados de esta factura. */
export type PagoDetectado = {
  saldoPendiente: string;
  siguienteParcialidad: string;
  pagosPrevios: PagoPrevio[];
};

export type PagoBorrador = {
  facturaOrigen: FacturaOrigenPago | null;
  /** "YYYY-MM-DDTHH:mm", como lo entrega un <input type="datetime-local">. */
  fechaPago: string;
  formaDePagoP: string;
  monedaP: string;
  tipoCambioP: string;
  monto: string;
  /** Saldo antes de este pago: se autocompleta con lo detectado, pero es editable. */
  impSaldoAnt: string;
  numParcialidad: string;
  detectado: PagoDetectado | null;
  /** Si el usuario quitó el pago detectado (prefiere capturar el saldo a mano). */
  usarDetectado: boolean;
};

export const PAGO_VACIO: PagoBorrador = {
  facturaOrigen: null,
  fechaPago: "",
  formaDePagoP: "03",
  monedaP: "MXN",
  tipoCambioP: "1",
  monto: "",
  impSaldoAnt: "",
  numParcialidad: "1",
  detectado: null,
  usarDetectado: true,
};

export const CONCEPTO_VACIO: ConceptoInput = {
  descripcion: "",
  claveProdServ: "",
  claveUnidad: "H87",
  unidad: "Pieza",
  cantidad: 1,
  valorUnitario: 0,
  impuestos: [{ id: "iva-traslado-inicial", tipo: IMPUESTO_IVA, naturaleza: "traslado", tasa: "0.160000" }],
};

export const BORRADOR_INICIAL: FacturaBorrador = {
  tipo: "I",
  relacion: { tipoRelacion: "01", uuids: [] },
  rfcEmisor: "",
  serie: "",
  folio: "",
  formaPago: "01",
  metodoPago: "PUE",
  condicionesDePago: "",
  receptorRfc: RFC_PUBLICO_GENERAL,
  usoCfdi: RECEPTOR_PUBLICO_GENERAL.UsoCFDI,
  conceptos: [{ ...CONCEPTO_VACIO }],
  pago: { ...PAGO_VACIO },
};

export const RECEPTOR_GENERICO: Receptor = {
  Rfc: RECEPTOR_PUBLICO_GENERAL.Rfc,
  Nombre: RECEPTOR_PUBLICO_GENERAL.Nombre,
  RegimenFiscal: RECEPTOR_PUBLICO_GENERAL.RegimenFiscalReceptor,
  DomicilioFiscal: "",
  UsoCfdi: RECEPTOR_PUBLICO_GENERAL.UsoCFDI,
};

/* -------------------------------------------------------------------------- */
/* Pasos                                                                      */
/* -------------------------------------------------------------------------- */

export type PasoId = "tipo" | "emisor" | "receptor" | "conceptos" | "pagos" | "revision";

export const PASOS: Array<{ id: PasoId; titulo: string; descripcion: string }> = [
  { id: "tipo", titulo: "Tipo", descripcion: "Qué comprobante vas a emitir" },
  { id: "emisor", titulo: "Emisor", descripcion: "Quién factura, serie y pago" },
  { id: "receptor", titulo: "Receptor", descripcion: "A quién le facturas" },
  { id: "conceptos", titulo: "Conceptos", descripcion: "Qué estás cobrando" },
  { id: "revision", titulo: "Revisión", descripcion: "Confirma antes de timbrar" },
];

/** Un CFDI de Pago no tiene receptor propio que capturar (viene de la
 * factura que se paga) ni conceptos reales - "Pagos" los reemplaza a ambos. */
const PASOS_PAGO: Array<{ id: PasoId; titulo: string; descripcion: string }> = [
  { id: "tipo", titulo: "Tipo", descripcion: "Qué comprobante vas a emitir" },
  { id: "emisor", titulo: "Emisor", descripcion: "Quién factura, serie y folio" },
  { id: "pagos", titulo: "Pago", descripcion: "Qué factura se paga y cuánto" },
  { id: "revision", titulo: "Revisión", descripcion: "Confirma antes de timbrar" },
];

export function pasosPara(
  tipo: TipoComprobante
): Array<{ id: PasoId; titulo: string; descripcion: string }> {
  return tipo === "P" ? PASOS_PAGO : PASOS;
}

/* -------------------------------------------------------------------------- */
/* Validación                                                                 */
/* -------------------------------------------------------------------------- */

export type Problema = {
  /** Identificador del campo, para pintar el error junto al control. */
  campo: string;
  mensaje: string;
};

export type Contexto = {
  emisores: Emisor[];
  series: Serie[];
  receptores: Receptor[];
};

const CLAVE_PROD_SERV = /^\d{8}$/;

/** Todos los problemas del borrador, agrupados por paso. */
export function validar(
  borrador: FacturaBorrador,
  ctx: Contexto
): Record<PasoId, Problema[]> {
  const emisor = ctx.emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;
  const receptor = receptorDe(borrador, ctx);

  const tipo: Problema[] = [];
  const opcion = TIPOS_COMPROBANTE.find((t) => t.value === borrador.tipo);
  if (!opcion?.disponible) {
    tipo.push({ campo: "tipo", mensaje: "Ese tipo de comprobante todavía no se puede emitir aquí." });
  }

  const emisorP: Problema[] = [];
  if (!borrador.rfcEmisor) {
    emisorP.push({ campo: "rfcEmisor", mensaje: "Elige el emisor de la factura." });
  } else if (!emisor) {
    emisorP.push({ campo: "rfcEmisor", mensaje: "Ese emisor ya no está disponible." });
  } else if (!emisor.Cert || !emisor.Key) {
    emisorP.push({
      campo: "rfcEmisor",
      mensaje: "Este emisor no tiene certificado de sello digital cargado: sin CSD no se puede timbrar.",
    });
  }
  if (!borrador.serie) {
    emisorP.push({
      campo: "serie",
      mensaje:
        ctx.series.length === 0
          ? `Este emisor no tiene ninguna serie de tipo ${etiquetaTipo(borrador.tipo)}. Crea una antes de facturar.`
          : "Elige la serie que va a llevar el comprobante.",
    });
  }
  if (!borrador.folio) {
    emisorP.push({ campo: "folio", mensaje: "No se pudo calcular el folio. Vuelve a elegir la serie." });
  }
  // Un CFDI de Pago no lleva FormaPago/MetodoPago a nivel comprobante (el
  // SAT los rechaza ahí): la forma de pago real va dentro de cada Pago del
  // complemento, capturada en el paso "Pago".
  if (borrador.tipo !== "P" && !borrador.formaPago) {
    emisorP.push({ campo: "formaPago", mensaje: "Elige la forma de pago." });
  }
  if (borrador.tipo !== "P" && !borrador.metodoPago) {
    emisorP.push({ campo: "metodoPago", mensaje: "Elige el método de pago." });
  }
  if (borrador.tipo === "E") {
    if (borrador.relacion.uuids.length === 0) {
      emisorP.push({
        campo: "relacion",
        mensaje: "Una nota de crédito debe decir qué factura corrige: relaciona al menos un CFDI.",
      });
    }
    const invalidos = borrador.relacion.uuids.filter((u) => !esUuid(u));
    if (invalidos.length > 0) {
      emisorP.push({
        campo: "relacion",
        mensaje: `Hay ${invalidos.length} folio(s) fiscal(es) con formato inválido.`,
      });
    }
    if (!borrador.relacion.tipoRelacion) {
      emisorP.push({ campo: "tipoRelacion", mensaje: "Elige el tipo de relación." });
    }
  }

  // El receptor de un CFDI de Pago no se elige: es el mismo de la factura
  // que se está pagando (ver receptorDe). Este paso ni siquiera se muestra
  // para tipo "P" (ver pasosPara), así que no tiene nada que validar.
  const receptorP: Problema[] = [];
  if (borrador.tipo !== "P") {
    if (!borrador.receptorRfc) {
      receptorP.push({ campo: "receptorRfc", mensaje: "Elige a quién le facturas." });
    } else if (!receptor) {
      receptorP.push({ campo: "receptorRfc", mensaje: "Ese receptor ya no está en tu lista." });
    } else if (borrador.receptorRfc !== RFC_PUBLICO_GENERAL) {
      if (!receptor.RegimenFiscal) {
        receptorP.push({
          campo: "receptorRfc",
          mensaje: "A este receptor le falta el régimen fiscal. Edítalo antes de facturarle.",
        });
      }
      if (!receptor.DomicilioFiscal) {
        receptorP.push({
          campo: "receptorRfc",
          mensaje: "A este receptor le falta el código postal de su domicilio fiscal.",
        });
      }
    }
    if (!borrador.usoCfdi) {
      receptorP.push({ campo: "usoCfdi", mensaje: "Elige el uso que le dará el receptor." });
    }
  }

  const conceptosP: Problema[] = [];
  if (borrador.tipo !== "P") {
    if (borrador.conceptos.length === 0) {
      conceptosP.push({ campo: "conceptos", mensaje: "Agrega al menos un concepto." });
    }
    borrador.conceptos.forEach((c, i) => {
      if (!c.descripcion.trim()) {
        conceptosP.push({ campo: `concepto.${i}.descripcion`, mensaje: "Falta la descripción." });
      }
      if (!CLAVE_PROD_SERV.test(c.claveProdServ.trim())) {
        conceptosP.push({
          campo: `concepto.${i}.claveProdServ`,
          mensaje: "La clave del SAT son 8 dígitos.",
        });
      }
      if (!(c.cantidad > 0)) {
        conceptosP.push({ campo: `concepto.${i}.cantidad`, mensaje: "La cantidad debe ser mayor a 0." });
      }
      if (!(c.valorUnitario > 0)) {
        conceptosP.push({
          campo: `concepto.${i}.valorUnitario`,
          mensaje: "El precio unitario debe ser mayor a 0.",
        });
      }
      if (!c.claveUnidad.trim()) {
        conceptosP.push({ campo: `concepto.${i}.claveUnidad`, mensaje: "Falta la unidad." });
      }
      const vistos = new Set<string>();
      for (const imp of c.impuestos) {
        const key = `${imp.tipo}-${imp.naturaleza}-${imp.tasa}`;
        if (vistos.has(key)) {
          conceptosP.push({
            campo: `concepto.${i}.impuestos`,
            mensaje: "Hay un impuesto repetido con la misma tasa en este concepto.",
          });
          break;
        }
        vistos.add(key);
      }
    });
    if (conceptosP.length === 0 && calcularTotales(borrador.conceptos).total <= 0) {
      conceptosP.push({ campo: "conceptos", mensaje: "El total del comprobante no puede ser 0." });
    }
  }

  const pagosP: Problema[] = [];
  if (borrador.tipo === "P") {
    const p = borrador.pago;
    if (!p.facturaOrigen) {
      pagosP.push({ campo: "facturaOrigen", mensaje: "Elige qué factura se va a pagar." });
    }
    if (!p.fechaPago) {
      pagosP.push({ campo: "fechaPago", mensaje: "Captura la fecha en que se recibió el pago." });
    }
    if (!p.formaDePagoP) {
      pagosP.push({ campo: "formaDePagoP", mensaje: "Elige la forma en que se recibió el pago." });
    }
    if (!p.monedaP) {
      pagosP.push({ campo: "monedaP", mensaje: "Elige la moneda del pago." });
    } else if (p.monedaP !== "MXN" && !(parseFloat(p.tipoCambioP) > 0)) {
      pagosP.push({ campo: "tipoCambioP", mensaje: "Captura el tipo de cambio de esa moneda." });
    }

    const monto = parseFloat(p.monto);
    if (!(monto > 0)) {
      pagosP.push({ campo: "monto", mensaje: "El monto pagado debe ser mayor a 0." });
    }

    if (p.facturaOrigen) {
      const saldoAnt = parseFloat(p.impSaldoAnt);
      if (!(saldoAnt > 0)) {
        pagosP.push({
          campo: "impSaldoAnt",
          mensaje: "No se pudo calcular el saldo pendiente de esa factura.",
        });
      } else if (monto > 0 && monto > saldoAnt + 0.01) {
        pagosP.push({
          campo: "monto",
          mensaje: `El monto no puede ser mayor al saldo pendiente (${saldoAnt.toFixed(2)}).`,
        });
      }
    }
  }

  return {
    tipo,
    emisor: emisorP,
    receptor: receptorP,
    conceptos: conceptosP,
    pagos: pagosP,
    // La revisión no valida nada propio: hereda lo de los pasos anteriores.
    revision: [],
  };
}

export function receptorDe(
  borrador: FacturaBorrador,
  ctx: Contexto
): Receptor | null {
  if (borrador.tipo === "P") {
    const fo = borrador.pago.facturaOrigen;
    if (!fo) return null;
    return {
      Rfc: fo.rfcReceptor,
      Nombre: fo.nombreReceptor,
      RegimenFiscal: fo.regimenFiscalReceptor,
      DomicilioFiscal: fo.domicilioFiscalReceptor,
      UsoCfdi: "CP01",
    };
  }
  if (borrador.receptorRfc === RFC_PUBLICO_GENERAL) return RECEPTOR_GENERICO;
  return ctx.receptores.find((r) => r.Rfc === borrador.receptorRfc) ?? null;
}

function esUuid(valor: string) {
  return /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(
    valor.trim()
  );
}

export function etiquetaTipo(tipo: string) {
  return TIPOS_COMPROBANTE.find((t) => t.value === tipo)?.label ?? tipo;
}

/* -------------------------------------------------------------------------- */
/* Totales                                                                    */
/* -------------------------------------------------------------------------- */

export function calcularTotales(conceptos: ConceptoInput[]) {
  let subtotal = 0;
  let trasladados = 0;
  let retenidos = 0;

  for (const c of conceptos) {
    const importe = (Number(c.cantidad) || 0) * (Number(c.valorUnitario) || 0);
    subtotal += importe;
    for (const imp of c.impuestos) {
      const monto = importe * parseFloat(imp.tasa);
      if (imp.naturaleza === "traslado") trasladados += monto;
      else retenidos += monto;
    }
  }

  return {
    subtotal,
    trasladados,
    retenidos,
    total: subtotal + trasladados - retenidos,
  };
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Arma el DoctoRelacionado que va dentro del Pago, prorrateando los
 * impuestos de la factura origen según el monto pagado.
 *
 * La fórmula (factor = monto pagado / total de la factura original,
 * aplicado a la Base de cada impuesto original) se verificó contra pagos
 * reales ya timbrados en el sistema: reproduce exactamente la Base y el
 * Importe que el SAT ya aceptó en pagos parciales anteriores.
 */
export function construirDoctoRelacionado(pago: PagoBorrador): DoctoRelacionadoInput | null {
  const fo = pago.facturaOrigen;
  if (!fo) return null;

  const monto = parseFloat(pago.monto) || 0;
  const totalOriginal = parseFloat(fo.total) || 0;
  const saldoAnt = parseFloat(pago.impSaldoAnt) || 0;
  const saldoInsoluto = Math.max(round2(saldoAnt - monto), 0);
  const factor = totalOriginal > 0 ? monto / totalOriginal : 0;

  function prorratear(items: ImpuestoOrigen[]): ImpuestoPagoInput[] {
    return items.map((imp) => {
      const base = parseFloat(imp.base) * factor;
      const importe = round2(base * parseFloat(imp.tasaOCuota));
      return {
        base: base.toFixed(6),
        impuesto: imp.impuesto,
        tipoFactor: imp.tipoFactor,
        tasaOCuota: imp.tasaOCuota,
        importe: importe.toFixed(2),
      };
    });
  }

  const trasladosDR = prorratear(fo.traslados);
  const retencionesDR = prorratear(fo.retenciones);

  return {
    idDocumento: fo.uuid,
    serie: fo.serie,
    folio: fo.folio,
    monedaDR: fo.moneda,
    // Solo hay tipo de cambio real entre MonedaDR y MonedaP cuando
    // difieren; si el pago se capturó en otra moneda que la de la factura
    // origen, se asume que tipoCambioP (contra MXN) también aplica aquí -
    // cubre el caso común (factura en MXN, pago en USD/EUR) sin pedir un
    // tercer tipo de cambio en el formulario.
    equivalenciaDR: fo.moneda === pago.monedaP ? "1" : pago.tipoCambioP || "1",
    numParcialidad: pago.numParcialidad || "1",
    impSaldoAnt: saldoAnt.toFixed(2),
    impPagado: monto.toFixed(2),
    impSaldoInsoluto: saldoInsoluto.toFixed(2),
    objetoImpDR: trasladosDR.length > 0 || retencionesDR.length > 0 ? "02" : "01",
    trasladosDR,
    retencionesDR,
  };
}
