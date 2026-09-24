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
import {
  CAPTURA_VACIA,
  complementosPorReceptor,
  problemasDePago,
  type CapturaPagos,
} from "@/lib/pagosCaptura";
import { IMPUESTO_IVA, RECEPTOR_PUBLICO_GENERAL } from "@/lib/catalogosSat";
import {
  problemasDeComplementos,
  totalesLocales,
  type ComplementosBorrador,
} from "@/lib/complementos";

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
   *
   * `href` es absoluto. Antes era un `segmento` relativo a /emisores/<rfc>,
   * porque esas pantallas colgaban del emisor; desde que el emisor vive en la
   * barra y no en la dirección, la ruta ya no depende de él.
   *
   * La distinción importa: "Próximamente" y "está en otra pantalla" se ven
   * igual de deshabilitados, pero uno significa que no existe y el otro que el
   * usuario está en el lugar equivocado. Decir lo primero cuando es lo segundo
   * hace que alguien concluya que la función no está.
   */
  hechoEn?: { etiqueta: string; href: string };
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
    hechoEn: { etiqueta: "Ir a Nómina", href: "/facturas/nomina" },
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

/**
 * c_TipoRelacion para una factura de ingreso. Las de nota de crédito, débito
 * y devolución (01, 02, 03) no están: esas se hacen desde "Nota de crédito".
 */
export const TIPOS_RELACION_FACTURA = [
  { value: "04", label: "04 - Sustitución de los CFDI previos" },
  { value: "05", label: "05 - Traslados de mercancías facturados previamente" },
  { value: "06", label: "06 - Factura generada por los traslados previos" },
  { value: "07", label: "07 - CFDI por aplicación de anticipo" },
  { value: "08", label: "08 - Factura generada por pagos en parcialidades" },
  { value: "09", label: "09 - Factura generada por pagos diferidos" },
] as const;

/** c_Exportacion. */
export const EXPORTACIONES = [
  { value: "01", label: "01 - No aplica" },
  { value: "02", label: "02 - Definitiva con clave A1" },
  { value: "03", label: "03 - Temporal" },
  { value: "04", label: "04 - Definitiva con clave distinta a A1" },
] as const;

/** c_Periodicidad (información global). */
export const PERIODICIDADES = [
  { value: "01", label: "01 - Diario" },
  { value: "02", label: "02 - Semanal" },
  { value: "03", label: "03 - Quincenal" },
  { value: "04", label: "04 - Mensual" },
  { value: "05", label: "05 - Bimestral" },
] as const;

/** c_Meses: 01-12 para todas las periodicidades menos la bimestral, que usa 13-18. */
export const MESES = [
  { value: "01", label: "01 - Enero" },
  { value: "02", label: "02 - Febrero" },
  { value: "03", label: "03 - Marzo" },
  { value: "04", label: "04 - Abril" },
  { value: "05", label: "05 - Mayo" },
  { value: "06", label: "06 - Junio" },
  { value: "07", label: "07 - Julio" },
  { value: "08", label: "08 - Agosto" },
  { value: "09", label: "09 - Septiembre" },
  { value: "10", label: "10 - Octubre" },
  { value: "11", label: "11 - Noviembre" },
  { value: "12", label: "12 - Diciembre" },
  { value: "13", label: "13 - Enero-Febrero" },
  { value: "14", label: "14 - Marzo-Abril" },
  { value: "15", label: "15 - Mayo-Junio" },
  { value: "16", label: "16 - Julio-Agosto" },
  { value: "17", label: "17 - Septiembre-Octubre" },
  { value: "18", label: "18 - Noviembre-Diciembre" },
] as const;

export function mesesPara(periodicidad: string) {
  return MESES.filter((m) => (periodicidad === "05") === Number(m.value) > 12);
}

/** Largo máximo de las observaciones (addenda SistemaLocal). */
export const OBSERVACIONES_MAX = 500;

/* -------------------------------------------------------------------------- */
/* Borrador                                                                   */
/* -------------------------------------------------------------------------- */

export type FacturaBorrador = {
  tipo: TipoComprobante;
  /**
   * CFDI relacionados. En la nota de crédito es obligatorio (paso "origen");
   * en la factura es opcional y solo cuenta si `relacionar` es true.
   */
  relacion: { tipoRelacion: string; uuids: string[] };
  relacionar: boolean;
  rfcEmisor: string;
  serie: string;
  folio: string;
  /** Si es false, se usa `fechaEmision` en vez de la fecha y hora de timbrar. */
  fechaActual: boolean;
  /** "YYYY-MM-DDTHH:mm", como lo entrega un <input type="datetime-local">. */
  fechaEmision: string;
  moneda: string;
  tipoCambio: string;
  exportacion: string;
  formaPago: string;
  metodoPago: string;
  condicionesDePago: string;
  receptorRfc: string;
  usoCfdi: string;
  /** Información global: solo aplica a Público en general en una factura. */
  global: { periodicidad: string; meses: string; anio: string };
  conceptos: ConceptoInput[];
  complementos: ComplementosBorrador;
  /** Van en la addenda SistemaLocal, como en el escritorio. No las revisa el SAT. */
  observaciones: string;
  /** Solo para tipo "P": los pagos que arma el usuario y sus facturas. */
  captura: CapturaPagos;
  /** Con pagos de varios receptores, el usuario confirmó que se timbran varios complementos. */
  confirmaVarios: boolean;
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
  relacionar: false,
  rfcEmisor: "",
  serie: "",
  folio: "",
  fechaActual: true,
  fechaEmision: "",
  moneda: "MXN",
  tipoCambio: "",
  exportacion: "01",
  formaPago: "01",
  metodoPago: "PUE",
  condicionesDePago: "",
  receptorRfc: RFC_PUBLICO_GENERAL,
  usoCfdi: RECEPTOR_PUBLICO_GENERAL.UsoCFDI,
  global: { periodicidad: "04", meses: "", anio: "" },
  conceptos: [{ ...CONCEPTO_VACIO }],
  complementos: {},
  observaciones: "",
  captura: CAPTURA_VACIA,
  confirmaVarios: false,
};

/**
 * Borrador nuevo para un tipo de comprobante, con lo que depende de hoy (mes
 * y año de la información global) y del tipo (relación y uso del CFDI).
 */
export function borradorPara(tipo: TipoComprobante, base: Partial<FacturaBorrador> = {}): FacturaBorrador {
  const hoy = new Date();
  return {
    ...BORRADOR_INICIAL,
    conceptos: [{ ...CONCEPTO_VACIO }],
    captura: { pagos: [], facturas: {}, decisiones: {} },
    global: {
      periodicidad: "04",
      meses: String(hoy.getMonth() + 1).padStart(2, "0"),
      anio: String(hoy.getFullYear()),
    },
    ...base,
    tipo,
    relacion: { tipoRelacion: tipo === "E" ? "01" : "04", uuids: [] },
    usoCfdi: tipo === "E" ? "G02" : BORRADOR_INICIAL.usoCfdi,
  };
}

/** ¿Este borrador lleva información global? Público en general en una factura. */
export function llevaGlobal(b: Pick<FacturaBorrador, "tipo" | "receptorRfc">) {
  return b.tipo === "I" && b.receptorRfc === RFC_PUBLICO_GENERAL;
}

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

/*
   Un paso es una pantalla y una sola pregunta. Antes eran tres pantallas y la
   del medio juntaba emisor, receptor, conceptos y forma de pago: un
   formulario tan largo que cansaba. Ahora cada tipo tiene su lista de pasos
   cortos, y el riel de la izquierda enseña en verde los que ya quedaron.

   El tipo de comprobante ya no es un paso: se elige en el menú antes de
   entrar, y cambiarlo es volver al menú.
*/

export type PasoId =
  | "emisor"
  | "origen"
  | "receptor"
  | "conceptos"
  | "pago"
  | "relacion"
  | "complementos"
  | "pagos"
  | "revision";

export type Paso = {
  id: PasoId;
  /** Nombre corto, para el riel. */
  titulo: string;
  /** La pregunta que hace la pantalla. */
  pregunta: string;
  /** Por qué se pide, en una línea. */
  porque: string;
};

const EMISOR: Paso = {
  id: "emisor",
  titulo: "Emisor y serie",
  pregunta: "¿Desde qué empresa facturas?",
  porque: "Tomamos el emisor que tienes activo. Cámbialo solo si este comprobante sale de otra empresa.",
};
const REVISION: Paso = {
  id: "revision",
  titulo: "Revisar y timbrar",
  pregunta: "Revisa y timbra",
  porque: "Así se va a timbrar. Cualquier dato lo puedes cambiar desde aquí.",
};

export const PASOS_POR_TIPO: Record<TipoComprobante, Paso[]> = {
  I: [
    EMISOR,
    {
      id: "receptor",
      titulo: "Receptor",
      pregunta: "¿A quién le facturas?",
      porque: "Elige el receptor de la factura. Sus datos fiscales ya están guardados.",
    },
    {
      id: "conceptos",
      titulo: "Conceptos",
      pregunta: "¿Qué vendiste?",
      porque: "Cada producto o servicio va en un concepto. Los impuestos se calculan solos.",
    },
    {
      id: "pago",
      titulo: "Forma de pago",
      pregunta: "¿Cómo te van a pagar?",
      porque: "Esto define si después tendrás que emitir complementos de pago.",
    },
    {
      id: "relacion",
      titulo: "CFDI relacionados",
      pregunta: "¿Esta factura se relaciona con otra?",
      porque:
        "Por ejemplo, si sustituye a una factura cancelada o aplica un anticipo. Si no, sigue adelante.",
    },
    {
      id: "complementos",
      titulo: "Complementos",
      pregunta: "¿Lleva algún complemento?",
      porque: "Agrega solo los que tu factura necesite. La mayoría no lleva ninguno.",
    },
    REVISION,
  ],
  E: [
    EMISOR,
    {
      id: "origen",
      titulo: "Factura que corrige",
      pregunta: "¿Qué factura corriges?",
      porque: "La nota de crédito siempre va ligada a una factura que ya emitiste.",
    },
    {
      id: "receptor",
      titulo: "Receptor",
      pregunta: "¿A quién va la nota de crédito?",
      porque: "Normalmente es el mismo receptor de la factura que corriges.",
    },
    {
      id: "conceptos",
      titulo: "Conceptos",
      pregunta: "¿Qué descuentas o devuelves?",
      porque: "Registra el importe que le regresas al cliente.",
    },
    {
      id: "pago",
      titulo: "Forma de pago",
      pregunta: "¿Cómo se lo regresas?",
      porque: "Normalmente es la misma forma de pago de la factura original.",
    },
    REVISION,
  ],
  P: [
    EMISOR,
    {
      id: "pagos",
      titulo: "Pagos",
      pregunta: "¿Qué pagos recibiste?",
      porque: "Agrega cada pago que te hicieron y elige qué facturas cubre. Tú decides cómo se arma cada uno.",
    },
    {
      id: "relacion",
      titulo: "CFDI relacionados",
      pregunta: "¿Sustituye a un complemento cancelado?",
      porque: "Casi nunca. Si no, sigue adelante.",
    },
    REVISION,
  ],
};

export function pasosPara(tipo: TipoComprobante): Paso[] {
  return PASOS_POR_TIPO[tipo];
}

/* -------------------------------------------------------------------------- */
/* Cómo se captura                                                            */
/* -------------------------------------------------------------------------- */

/**
 * `una` es el formulario de siempre. `plantilla` sube el .xlsx que ya usa la
 * aplicación de escritorio y crea un lote.
 *
 * No hay opción de "desde una prefactura guardada": el borrador de una factura
 * vive solo en memoria y no existe dónde guardarlo. Las prenóminas sí existen,
 * pero son de nómina, que es otro asistente.
 */
export type ModoCaptura = "una" | "plantilla";

/**
 * Qué plantilla de Excel corresponde a cada tipo de comprobante.
 *
 * Son las mismas tres que genera el escritorio. Nómina no aparece porque se
 * corre por periodo y tiene su propia pantalla.
 */
export function tipoPlantillaDe(tipo: TipoComprobante): "PREFACTURA" | "PAGO" {
  return tipo === "P" ? "PAGO" : "PREFACTURA";
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

/**
 * Problemas de la lista de conceptos. Aparte de validar() porque también los
 * usa la autofactura por QR, que captura conceptos sin el resto del borrador.
 */
export function problemasDeConceptos(conceptos: ConceptoInput[]): Problema[] {
  const conceptosP: Problema[] = [];
  if (conceptos.length === 0) {
    conceptosP.push({ campo: "conceptos", mensaje: "Agrega al menos un concepto." });
  }
  conceptos.forEach((c, i) => {
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
  if (conceptosP.length === 0 && calcularTotales(conceptos).total <= 0) {
    conceptosP.push({ campo: "conceptos", mensaje: "El total del comprobante no puede ser 0." });
  }
  return conceptosP;
}

/**
 * Revisa la fecha de emisión elegida a mano. Son las mismas reglas que aplica
 * REGLAS_CFDI40 en el servidor: no puede estar en el futuro (con 5 minutos de
 * holgura) ni tener más de 72 horas, porque el PAC la rechaza.
 */
function problemaDeFecha(fecha: string, ahora = new Date()): string | null {
  if (!fecha) return "Escribe la fecha de emisión o usa la de hoy.";
  const f = new Date(fecha);
  if (Number.isNaN(f.getTime())) return "La fecha de emisión no es válida.";
  const diferencia = ahora.getTime() - f.getTime();
  if (diferencia < -5 * 60 * 1000) return "La fecha de emisión no puede estar en el futuro.";
  if (diferencia > 72 * 60 * 60 * 1000) {
    return "El SAT no acepta comprobantes con fecha de más de 72 horas atrás.";
  }
  return null;
}

/** Todos los problemas del borrador, agrupados por paso. */
export function validar(
  borrador: FacturaBorrador,
  ctx: Contexto
): Record<PasoId, Problema[]> {
  const emisor = ctx.emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;
  const receptor = receptorDe(borrador, ctx);
  const esPago = borrador.tipo === "P";

  /* ---------- Emisor y serie (y fecha, moneda, exportación) ---------- */
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
  if (!esPago) {
    if (!borrador.fechaActual) {
      const error = problemaDeFecha(borrador.fechaEmision);
      if (error) emisorP.push({ campo: "fechaEmision", mensaje: error });
    }
    if (borrador.moneda !== "MXN" && !(parseFloat(borrador.tipoCambio) > 0)) {
      emisorP.push({
        campo: "tipoCambio",
        mensaje: `Con ${borrador.moneda} hace falta el tipo de cambio.`,
      });
    }
  }

  /* ---------- Factura que corrige (nota de crédito) ---------- */
  const origenP: Problema[] = [];
  if (borrador.tipo === "E") {
    if (borrador.relacion.uuids.length === 0) {
      origenP.push({
        campo: "relacion",
        mensaje: "Una nota de crédito debe decir qué factura corrige: relaciona al menos un CFDI.",
      });
    }
    if (!borrador.relacion.tipoRelacion) {
      origenP.push({ campo: "tipoRelacion", mensaje: "Elige por qué corriges la factura." });
    }
  }

  /* ---------- CFDI relacionados (factura) ---------- */
  const relacionP: Problema[] = [];
  if (borrador.tipo !== "E" && borrador.relacionar && borrador.relacion.uuids.length === 0) {
    relacionP.push({
      campo: "relacion",
      mensaje: "Elige al menos una factura relacionada o cambia a “No se relaciona”.",
    });
  }
  const relaciona = borrador.tipo === "E" || borrador.relacionar;
  const invalidos = relaciona ? borrador.relacion.uuids.filter((u) => !esUuid(u)) : [];
  if (invalidos.length > 0) {
    (borrador.tipo === "E" ? origenP : relacionP).push({
      campo: "relacion",
      mensaje: `Hay ${invalidos.length} folio(s) fiscal(es) con formato inválido.`,
    });
  }

  /* ---------- Receptor ---------- */
  // El receptor de un CFDI de Pago no se elige: es el mismo de la factura
  // que se está pagando (ver receptorDe).
  const receptorP: Problema[] = [];
  if (!esPago) {
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
    if (llevaGlobal(borrador)) {
      const g = borrador.global;
      if (!g.periodicidad) {
        receptorP.push({ campo: "global.periodicidad", mensaje: "Elige la periodicidad de la información global." });
      }
      if (!mesesPara(g.periodicidad).some((m) => m.value === g.meses)) {
        receptorP.push({
          campo: "global.meses",
          mensaje:
            g.periodicidad === "05"
              ? "Con periodicidad bimestral elige un bimestre (13 a 18)."
              : "Elige el mes de la información global.",
        });
      }
      const anio = Number(g.anio);
      if (!/^\d{4}$/.test(g.anio) || anio > new Date().getFullYear()) {
        receptorP.push({ campo: "global.anio", mensaje: "Elige el año de la información global." });
      }
    }
  }

  /* ---------- Conceptos ---------- */
  const conceptosP: Problema[] = esPago ? [] : problemasDeConceptos(borrador.conceptos);

  /* ---------- Forma de pago ---------- */
  // Un CFDI de Pago no lleva FormaPago/MetodoPago a nivel comprobante (el SAT
  // los rechaza ahí): la forma real va dentro de cada Pago del complemento.
  const pagoP: Problema[] = [];
  if (!esPago) {
    if (!borrador.metodoPago) {
      pagoP.push({ campo: "metodoPago", mensaje: "Elige cómo te van a pagar." });
    }
    if (!borrador.formaPago) {
      pagoP.push({ campo: "formaPago", mensaje: "Elige la forma de pago." });
    } else if (borrador.metodoPago === "PPD" && borrador.formaPago !== "99") {
      pagoP.push({ campo: "formaPago", mensaje: "Con PPD la forma de pago debe ser 99 Por definir." });
    } else if (borrador.metodoPago === "PUE" && borrador.formaPago === "99") {
      pagoP.push({ campo: "formaPago", mensaje: "Con PUE elige la forma de pago real, no 99 Por definir." });
    }
  }

  /* ---------- Complementos ---------- */
  const complementosP: Problema[] =
    borrador.tipo === "I" ? problemasDeComplementos(borrador.complementos) : [];

  /* ---------- Complemento de pago ---------- */
  const pagosP: Problema[] = [];
  if (esPago) {
    const c = borrador.captura;
    if (c.pagos.length === 0) {
      pagosP.push({ campo: "pagos", mensaje: "Agrega al menos un pago." });
    }
    c.pagos.forEach((p, i) => {
      const nombre = `Pago del ${p.fecha.split("-").reverse().join("/")}`;
      for (const mensaje of problemasDePago(c, p).errores) {
        pagosP.push({ campo: `pago.${i}`, mensaje: `${nombre}: ${mensaje}` });
      }
    });
  }

  /* ---------- Revisión: solo las observaciones son suyas ---------- */
  const revisionP: Problema[] = [];
  if (esPago && complementosPorReceptor(borrador.captura).length > 1 && !borrador.confirmaVarios) {
    revisionP.push({
      campo: "confirmaVarios",
      mensaje: `Confirma que vas a timbrar ${complementosPorReceptor(borrador.captura).length} complementos, uno por receptor.`,
    });
  }
  if (borrador.observaciones.length > OBSERVACIONES_MAX) {
    revisionP.push({
      campo: "observaciones",
      mensaje: `Las observaciones pueden tener hasta ${OBSERVACIONES_MAX} caracteres.`,
    });
  }

  return {
    emisor: emisorP,
    origen: origenP,
    receptor: receptorP,
    conceptos: conceptosP,
    pago: pagoP,
    relacion: relacionP,
    complementos: complementosP,
    pagos: pagosP,
    revision: revisionP,
  };
}

export function receptorDe(
  borrador: FacturaBorrador,
  ctx: Contexto
): Receptor | null {
  if (borrador.tipo === "P") {
    // El receptor sale de las facturas del primer complemento; con varios
    // receptores, cada complemento lleva el suyo al timbrar.
    const r = complementosPorReceptor(borrador.captura)[0]?.receptor;
    if (!r) return null;
    return { Rfc: r.rfc, Nombre: r.nombre, RegimenFiscal: r.regimen, DomicilioFiscal: r.cp, UsoCfdi: "CP01" };
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

/**
 * Totales del comprobante. Los impuestos locales (complemento implocal) van
 * aparte: el SAT los suma al Total además de los federales.
 */
export function calcularTotales(conceptos: ConceptoInput[], complementos?: ComplementosBorrador) {
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

  const locales = totalesLocales(complementos, subtotal);

  return {
    subtotal,
    trasladados,
    retenidos,
    localesTrasladados: locales.traslados,
    localesRetenidos: locales.retenciones,
    total: subtotal + trasladados - retenidos + locales.traslados - locales.retenciones,
  };
}
