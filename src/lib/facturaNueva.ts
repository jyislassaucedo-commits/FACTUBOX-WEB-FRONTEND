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

import type { ConceptoInput, TipoComprobante } from "@/lib/timbrado";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
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
      "Para facturas PPD, cuando el cliente abona. Necesita el complemento de recepción de pagos.",
    disponible: false,
    motivo: "Necesita el complemento Pagos 2.0, que aún no está en esta pantalla.",
  },
  {
    value: "N",
    label: "Nómina",
    resumen: "Recibo de nómina",
    detalle: "Pago a empleados, con percepciones, deducciones e incidencias.",
    disponible: false,
    motivo: "Necesita el complemento Nómina 1.2, que aún no está en esta pantalla.",
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

export type PasoId = "tipo" | "emisor" | "receptor" | "conceptos" | "revision";

export const PASOS: Array<{ id: PasoId; titulo: string; descripcion: string }> = [
  { id: "tipo", titulo: "Tipo", descripcion: "Qué comprobante vas a emitir" },
  { id: "emisor", titulo: "Emisor", descripcion: "Quién factura, serie y pago" },
  { id: "receptor", titulo: "Receptor", descripcion: "A quién le facturas" },
  { id: "conceptos", titulo: "Conceptos", descripcion: "Qué estás cobrando" },
  { id: "revision", titulo: "Revisión", descripcion: "Confirma antes de timbrar" },
];

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
  if (!borrador.formaPago) {
    emisorP.push({ campo: "formaPago", mensaje: "Elige la forma de pago." });
  }
  if (!borrador.metodoPago) {
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

  const receptorP: Problema[] = [];
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

  const conceptosP: Problema[] = [];
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

  return {
    tipo,
    emisor: emisorP,
    receptor: receptorP,
    conceptos: conceptosP,
    // La revisión no valida nada propio: hereda lo de los pasos anteriores.
    revision: [],
  };
}

export function receptorDe(
  borrador: FacturaBorrador,
  ctx: Contexto
): Receptor | null {
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
