/* Nómina manual: el formulario, sus reglas y sus totales, sin nada de servidor.
 *
 * Es la fuente única del modelo: lo que se captura en el asistente, lo que se
 * guarda como prenómina (verbatim, en JSON) y lo que el backend recibe en
 * `getCfdiNominaManualV2`. Del lado PHP, `NominaManual` lee exactamente esta
 * forma; cambiar una llave aquí sin cambiarla allá es una plantilla que ya no
 * se puede timbrar.
 *
 * `validarManual` y `totalesDe` son el espejo de `NominaManual::validar()` y
 * `::totales()`. Se duplican a propósito: la pantalla necesita señalar el campo
 * mientras se escribe y pintar el neto en vivo, sin ir al servidor por cada
 * tecla. El servidor vuelve a validar al armar el CFDI, así que un desfase
 * entre los dos no deja pasar nada, solo se nota más tarde. */

import type { Empleado } from "./empleados";
import type { ConceptoRecibo } from "./nomina";

export const NOMINA_MANUAL_VERSION = 1 as const;

export type HorasExtraManual = {
  dias: string;
  tipoHoras: string;
  horasExtra: string;
  importePagado: string;
};

export type PercepcionManual = {
  /** Identificador local para las filas de React; no viaja al XML. */
  id: string;
  tipo: string;
  clave: string;
  concepto: string;
  importeGravado: string;
  importeExento: string;
  /** Solo en la 019: un renglón por tipo de hora. */
  horasExtra?: HorasExtraManual[];
  /** Solo en la 045. */
  accionesOTitulos?: { valorMercado: string; precioAlOtorgarse: string };
};

export type JubilacionManual = {
  modalidad: "UNA_EXHIBICION" | "PARCIALIDAD";
  totalUnaExhibicion: string;
  totalParcialidad: string;
  montoDiario: string;
  ingresoAcumulable: string;
  ingresoNoAcumulable: string;
};

export type SeparacionManual = {
  totalPagado: string;
  numAniosServicio: string;
  ultimoSueldoMensOrd: string;
  ingresoAcumulable: string;
  ingresoNoAcumulable: string;
};

export type DeduccionManual = {
  id: string;
  tipo: string;
  clave: string;
  concepto: string;
  importe: string;
};

export type OtroPagoManual = {
  id: string;
  tipo: string;
  clave: string;
  concepto: string;
  importe: string;
  /** Solo en el 002: lo que le tocaba, aunque no se le entregue. */
  subsidioCausado?: string;
  /** Solo en el 004. */
  compensacion?: { saldoAFavor: string; anio: string; remanenteSalFav: string };
};

export type IncapacidadManual = {
  id: string;
  dias: string;
  tipoIncapacidad: string;
  importeMonetario: string;
};

export type SubContratacionManual = {
  id: string;
  rfcLabora: string;
  porcentajeTiempo: string;
};

export type RelacionadosManual = { tipoRelacion: string; uuids: string[] };

export type AntiguedadFormato = "W" | "YMD" | "NINGUNA";

export type NominaManualForm = {
  version: typeof NOMINA_MANUAL_VERSION;
  idEmpleado: string;
  serie: string;
  periodo: {
    tipoNomina: "O" | "E";
    periodicidad: string;
    fechaInicialPago: string;
    fechaFinalPago: string;
    fechaPago: string;
    diasPagados: string;
  };
  /** "W" es lo de siempre (P136W); "YMD" es P3Y2M15D; "NINGUNA" la omite. */
  antiguedadFormato: AntiguedadFormato;
  percepciones: PercepcionManual[];
  /** Uno por comprobante, no por renglón: así lo declara el esquema. */
  jubilacion: JubilacionManual | null;
  separacion: SeparacionManual | null;
  deducciones: DeduccionManual[];
  otrosPagos: OtroPagoManual[];
  incapacidades: IncapacidadManual[];
  subcontratacion: SubContratacionManual[];
  relacionados: RelacionadosManual | null;
  /** Nota interna de la plantilla; no va al XML. */
  observaciones: string;
};

/* -------------------------------------------------------------------------- */
/* Constantes del complemento                                                 */
/* -------------------------------------------------------------------------- */

export const SEPARACION = ["022", "023", "025"];
export const JUBILACION = ["039", "044"];
export const OTRO_PAGO_UNICO = ["002", "007", "008"];
export const REGIMENES_CON_SUBSIDIO = ["02", "03", "04"];
export const CLAVE_INTERNA = /^[^|]{3,15}$/;
const RFC = /^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$/;
const UUID = /^[0-9a-fA-F]{8}(-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export const TIPOS_RELACION_NOMINA = [
  { value: "04", label: "04 - Sustitución de los CFDI previos" },
  { value: "01", label: "01 - Nota de crédito de los documentos relacionados" },
  { value: "02", label: "02 - Nota de débito de los documentos relacionados" },
  { value: "03", label: "03 - Devolución de mercancía sobre facturas o traslados previos" },
];

export const FORMATOS_ANTIGUEDAD: Array<{ value: AntiguedadFormato; label: string }> = [
  { value: "W", label: "En semanas (P136W) — recomendado" },
  { value: "YMD", label: "En años, meses y días (P4Y3M3D) — el PAC la cambia seguido" },
  { value: "NINGUNA", label: "No mandarla" },
];

/* -------------------------------------------------------------------------- */
/* Construcción                                                               */
/* -------------------------------------------------------------------------- */

let contador = 0;
export function idLocal(): string {
  contador += 1;
  return `${Date.now().toString(36)}-${contador}`;
}

export const FORM_VACIO: NominaManualForm = {
  version: NOMINA_MANUAL_VERSION,
  idEmpleado: "",
  serie: "",
  periodo: {
    tipoNomina: "O",
    periodicidad: "",
    fechaInicialPago: "",
    fechaFinalPago: "",
    fechaPago: "",
    diasPagados: "",
  },
  antiguedadFormato: "W",
  percepciones: [],
  jubilacion: null,
  separacion: null,
  deducciones: [],
  otrosPagos: [],
  incapacidades: [],
  subcontratacion: [],
  relacionados: null,
  observaciones: "",
};

export function nuevaPercepcion(tipo = ""): PercepcionManual {
  return { id: idLocal(), tipo, clave: tipo, concepto: "", importeGravado: "", importeExento: "0" };
}

export function nuevaDeduccion(tipo = ""): DeduccionManual {
  return { id: idLocal(), tipo, clave: tipo, concepto: "", importe: "" };
}

export function nuevoOtroPago(tipo = ""): OtroPagoManual {
  return { id: idLocal(), tipo, clave: tipo, concepto: "", importe: "" };
}

export function nuevaIncapacidad(): IncapacidadManual {
  return { id: idLocal(), dias: "", tipoIncapacidad: "", importeMonetario: "0" };
}

export function nuevaSubContratacion(): SubContratacionManual {
  return { id: idLocal(), rfcLabora: "", porcentajeTiempo: "" };
}

export const JUBILACION_VACIA: JubilacionManual = {
  modalidad: "UNA_EXHIBICION",
  totalUnaExhibicion: "",
  totalParcialidad: "",
  montoDiario: "",
  ingresoAcumulable: "0",
  ingresoNoAcumulable: "0",
};

export const SEPARACION_VACIA: SeparacionManual = {
  totalPagado: "",
  numAniosServicio: "",
  ultimoSueldoMensOrd: "",
  ingresoAcumulable: "0",
  ingresoNoAcumulable: "0",
};

function texto(v: unknown, porDefecto = ""): string {
  if (v === null || v === undefined) return porDefecto;
  if (typeof v === "object") return porDefecto;
  const s = String(v).trim();
  return s === "" ? porDefecto : s;
}

function lista(v: unknown): Record<string, unknown>[] {
  return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

/**
 * Lo que venga (una prenómina guardada con una versión vieja, un JSON a
 * medias) convertido en un formulario con todas sus llaves e ids de fila.
 */
export function normalizarForm(raw: unknown): NominaManualForm {
  const r = obj(raw) ?? {};
  const p = obj(r.periodo) ?? {};
  const tipoNomina = texto(p.tipoNomina, "O").toUpperCase() === "E" ? "E" : "O";
  const formatoRaw = texto(r.antiguedadFormato, "W").toUpperCase();
  const antiguedadFormato: AntiguedadFormato =
    formatoRaw === "YMD" ? "YMD" : formatoRaw === "NINGUNA" ? "NINGUNA" : "W";

  const percepciones: PercepcionManual[] = lista(r.percepciones).map((x) => {
    const tipo = texto(x.tipo);
    const fila: PercepcionManual = {
      id: texto(x.id) || idLocal(),
      tipo,
      clave: texto(x.clave) || tipo,
      concepto: texto(x.concepto),
      importeGravado: texto(x.importeGravado, "0"),
      importeExento: texto(x.importeExento, "0"),
    };
    const horas = lista(x.horasExtra).map((h) => ({
      dias: texto(h.dias),
      tipoHoras: texto(h.tipoHoras),
      horasExtra: texto(h.horasExtra),
      importePagado: texto(h.importePagado, "0"),
    }));
    if (horas.length > 0) fila.horasExtra = horas;
    const acciones = obj(x.accionesOTitulos);
    if (acciones) {
      fila.accionesOTitulos = {
        valorMercado: texto(acciones.valorMercado),
        precioAlOtorgarse: texto(acciones.precioAlOtorgarse),
      };
    }
    return fila;
  });

  const jub = obj(r.jubilacion);
  const sep = obj(r.separacion);
  const rel = obj(r.relacionados);
  const uuids = Array.isArray(rel?.uuids)
    ? rel!.uuids.map((u) => texto(u).toUpperCase()).filter((u) => u !== "")
    : [];

  return {
    version: NOMINA_MANUAL_VERSION,
    idEmpleado: texto(r.idEmpleado),
    serie: texto(r.serie),
    periodo: {
      tipoNomina,
      periodicidad: texto(p.periodicidad),
      fechaInicialPago: texto(p.fechaInicialPago),
      fechaFinalPago: texto(p.fechaFinalPago),
      fechaPago: texto(p.fechaPago),
      diasPagados: texto(p.diasPagados),
    },
    antiguedadFormato,
    percepciones,
    jubilacion: jub
      ? {
          modalidad: texto(jub.modalidad).toUpperCase() === "PARCIALIDAD" ? "PARCIALIDAD" : "UNA_EXHIBICION",
          totalUnaExhibicion: texto(jub.totalUnaExhibicion),
          totalParcialidad: texto(jub.totalParcialidad),
          montoDiario: texto(jub.montoDiario),
          ingresoAcumulable: texto(jub.ingresoAcumulable, "0"),
          ingresoNoAcumulable: texto(jub.ingresoNoAcumulable, "0"),
        }
      : null,
    separacion: sep
      ? {
          totalPagado: texto(sep.totalPagado),
          numAniosServicio: texto(sep.numAniosServicio),
          ultimoSueldoMensOrd: texto(sep.ultimoSueldoMensOrd),
          ingresoAcumulable: texto(sep.ingresoAcumulable, "0"),
          ingresoNoAcumulable: texto(sep.ingresoNoAcumulable, "0"),
        }
      : null,
    deducciones: lista(r.deducciones).map((x) => {
      const tipo = texto(x.tipo);
      return {
        id: texto(x.id) || idLocal(),
        tipo,
        clave: texto(x.clave) || tipo,
        concepto: texto(x.concepto),
        importe: texto(x.importe, "0"),
      };
    }),
    otrosPagos: lista(r.otrosPagos).map((x) => {
      const tipo = texto(x.tipo);
      const fila: OtroPagoManual = {
        id: texto(x.id) || idLocal(),
        tipo,
        clave: texto(x.clave) || tipo,
        concepto: texto(x.concepto),
        importe: texto(x.importe, "0"),
      };
      if (texto(x.subsidioCausado) !== "") fila.subsidioCausado = texto(x.subsidioCausado);
      const comp = obj(x.compensacion);
      if (comp) {
        fila.compensacion = {
          saldoAFavor: texto(comp.saldoAFavor),
          anio: texto(comp.anio),
          remanenteSalFav: texto(comp.remanenteSalFav, "0"),
        };
      }
      return fila;
    }),
    incapacidades: lista(r.incapacidades).map((x) => ({
      id: texto(x.id) || idLocal(),
      dias: texto(x.dias),
      tipoIncapacidad: texto(x.tipoIncapacidad),
      importeMonetario: texto(x.importeMonetario, "0"),
    })),
    subcontratacion: lista(r.subcontratacion).map((x) => ({
      id: texto(x.id) || idLocal(),
      rfcLabora: texto(x.rfcLabora).toUpperCase(),
      porcentajeTiempo: texto(x.porcentajeTiempo),
    })),
    relacionados:
      rel && (uuids.length > 0 || texto(rel.tipoRelacion) !== "")
        ? { tipoRelacion: texto(rel.tipoRelacion), uuids }
        : null,
    observaciones: texto(r.observaciones),
  };
}

/* -------------------------------------------------------------------------- */
/* Pasos y validación                                                         */
/* -------------------------------------------------------------------------- */

export type PasoManualId = "empleado" | "periodo" | "conceptos" | "extras" | "revision";

export const PASOS_MANUAL: Array<{ id: PasoManualId; titulo: string; descripcion: string }> = [
  { id: "empleado", titulo: "Empleado", descripcion: "A quién se le paga" },
  { id: "periodo", titulo: "Periodo", descripcion: "Fechas, días y serie" },
  { id: "conceptos", titulo: "Conceptos", descripcion: "Percepciones, deducciones y otros pagos" },
  { id: "extras", titulo: "Extras", descripcion: "Incapacidades, subcontratación, relacionados" },
  { id: "revision", titulo: "Revisión", descripcion: "Revisar y timbrar" },
];

export type ProblemaManual = { paso: PasoManualId; campo: string; mensaje: string };

function esNumero(v: string): boolean {
  return v.trim() !== "" && Number.isFinite(Number(v));
}

function esEntero(v: string): boolean {
  return /^\d+$/.test(v.trim());
}

function num(v: string): number {
  return esNumero(v) ? Number(v) : -1;
}

/** Espejo de NominaManual::validar(). Mismos mensajes, mismos campos. */
export function validarManual(form: NominaManualForm, empleado: Empleado | null): ProblemaManual[] {
  const e: ProblemaManual[] = [];
  const add = (paso: PasoManualId, campo: string, mensaje: string) => e.push({ paso, campo, mensaje });
  const p = form.periodo;

  if (!form.idEmpleado || !empleado) add("empleado", "idEmpleado", "Elige al empleado.");

  for (const [campo, nombre] of [
    ["fechaInicialPago", "inicial"],
    ["fechaFinalPago", "final"],
    ["fechaPago", "de pago"],
  ] as const) {
    if (!FECHA.test(p[campo])) add("periodo", `periodo.${campo}`, `Falta la fecha ${nombre}.`);
  }
  if (p.fechaFinalPago && p.fechaInicialPago && p.fechaFinalPago < p.fechaInicialPago) {
    add("periodo", "periodo.fechaFinalPago", "La fecha final es anterior a la inicial.");
  }
  if (p.fechaPago && p.fechaInicialPago && p.fechaPago < p.fechaInicialPago) {
    add("periodo", "periodo.fechaPago", "La fecha de pago es anterior al inicio del periodo.");
  }
  if (num(p.diasPagados) <= 0) add("periodo", "periodo.diasPagados", "Los días pagados tienen que ser mayores a cero.");
  if (p.tipoNomina !== "E" && !/^\d{2}$/.test(p.periodicidad)) {
    add("periodo", "periodo.periodicidad", "Falta la periodicidad de pago.");
  }
  if (!form.serie) add("periodo", "serie", "Elige la serie con la que se va a timbrar.");

  const renglon = (ref: string, r: { tipo: string; clave: string; concepto: string }) => {
    if (!/^\d{3}$/.test(r.tipo)) add("conceptos", `${ref}.tipo`, "Elige la clave del catálogo del SAT.");
    if (!CLAVE_INTERNA.test(r.clave)) add("conceptos", `${ref}.clave`, 'La clave interna debe tener de 3 a 15 caracteres y no llevar "|".');
    const largo = r.concepto.trim().length;
    if (largo < 1 || largo > 100) add("conceptos", `${ref}.concepto`, "El concepto debe tener entre 1 y 100 caracteres.");
  };

  let hay019 = 0;
  let hayJubilacion = false;
  let haySeparacion = false;
  form.percepciones.forEach((r, i) => {
    const ref = `percepciones[${i}]`;
    renglon(ref, r);
    const g = num(r.importeGravado);
    const x = num(r.importeExento);
    if (g < 0) add("conceptos", `${ref}.importeGravado`, "El importe gravado no es un número válido.");
    if (x < 0) add("conceptos", `${ref}.importeExento`, "El importe exento no es un número válido.");
    if (g === 0 && x === 0) add("conceptos", `${ref}.importeGravado`, "Una percepción no puede llevar gravado y exento en cero.");
    if (r.tipo === "038" && x > 0) add("conceptos", `${ref}.importeExento`, "La percepción 038 va toda gravada: el exento debe ser 0.");
    if (r.tipo === "019") {
      hay019++;
      const horas = r.horasExtra ?? [];
      if (horas.length === 0) add("conceptos", `${ref}.horasExtra`, "Las horas extra (019) necesitan al menos un renglón con días, tipo, horas e importe.");
      horas.forEach((h, j) => {
        const hr = `${ref}.horasExtra[${j}]`;
        if (!esEntero(h.dias) || Number(h.dias) < 1) add("conceptos", `${hr}.dias`, "Los días deben ser un entero mayor a cero.");
        if (!["01", "02", "03"].includes(h.tipoHoras)) add("conceptos", `${hr}.tipoHoras`, "Elige el tipo de horas.");
        if (!esEntero(h.horasExtra) || Number(h.horasExtra) < 1) add("conceptos", `${hr}.horasExtra`, "Las horas deben ser un entero mayor a cero.");
        if (num(h.importePagado) < 0) add("conceptos", `${hr}.importePagado`, "El importe pagado no es válido.");
      });
    }
    if (r.tipo === "045") {
      const a = r.accionesOTitulos;
      if (!a || num(a.valorMercado) <= 0 || num(a.precioAlOtorgarse) <= 0) {
        add("conceptos", `${ref}.accionesOTitulos`, "La percepción 045 necesita valor de mercado y precio al otorgarse, ambos mayores a cero.");
      }
    }
    if (JUBILACION.includes(r.tipo)) hayJubilacion = true;
    if (SEPARACION.includes(r.tipo)) haySeparacion = true;
  });
  if (hay019 > 1) add("conceptos", "percepciones", "Solo puede haber una percepción 019 (horas extra); junta los renglones de horas dentro de ella.");

  if (hayJubilacion) {
    const j = form.jubilacion;
    if (!j) {
      add("conceptos", "jubilacion", "Hay una percepción de jubilación, pensión o retiro (039/044): captura los datos de JubilacionPensionRetiro.");
    } else {
      if (j.modalidad === "PARCIALIDAD") {
        if (num(j.totalParcialidad) <= 0) add("conceptos", "jubilacion.totalParcialidad", "El total de la parcialidad debe ser mayor a cero.");
        if (num(j.montoDiario) <= 0) add("conceptos", "jubilacion.montoDiario", "El monto diario debe ser mayor a cero.");
      } else if (num(j.totalUnaExhibicion) <= 0) {
        add("conceptos", "jubilacion.totalUnaExhibicion", "El total en una exhibición debe ser mayor a cero.");
      }
      if (num(j.ingresoAcumulable) < 0) add("conceptos", "jubilacion.ingresoAcumulable", "El ingreso acumulable no es válido.");
      if (num(j.ingresoNoAcumulable) < 0) add("conceptos", "jubilacion.ingresoNoAcumulable", "El ingreso no acumulable no es válido.");
    }
  }
  if (haySeparacion) {
    const s = form.separacion;
    if (!s) {
      add("conceptos", "separacion", "Hay una percepción de separación o indemnización (022/023/025): captura los datos de SeparacionIndemnizacion.");
    } else {
      if (num(s.totalPagado) <= 0) add("conceptos", "separacion.totalPagado", "El total pagado debe ser mayor a cero.");
      if (!esEntero(s.numAniosServicio) || Number(s.numAniosServicio) > 99) add("conceptos", "separacion.numAniosServicio", "Los años de servicio deben ser un entero entre 0 y 99.");
      if (num(s.ultimoSueldoMensOrd) < 0) add("conceptos", "separacion.ultimoSueldoMensOrd", "El último sueldo mensual no es válido.");
      if (num(s.ingresoAcumulable) < 0) add("conceptos", "separacion.ingresoAcumulable", "El ingreso acumulable no es válido.");
      if (num(s.ingresoNoAcumulable) < 0) add("conceptos", "separacion.ingresoNoAcumulable", "El ingreso no acumulable no es válido.");
    }
  }

  form.deducciones.forEach((r, i) => {
    const ref = `deducciones[${i}]`;
    renglon(ref, r);
    if (num(r.importe) <= 0) add("conceptos", `${ref}.importe`, "Una deducción debe llevar importe mayor a cero; el PAC rechaza una deducción en cero.");
  });

  let unicos = 0;
  form.otrosPagos.forEach((r, i) => {
    const ref = `otrosPagos[${i}]`;
    renglon(ref, r);
    const importe = num(r.importe);
    if (importe < 0) add("conceptos", `${ref}.importe`, "El importe no es un número válido.");
    else if (importe === 0 && r.tipo !== "002") add("conceptos", `${ref}.importe`, "Un otro pago debe llevar importe mayor a cero (solo el subsidio 002 puede ir en cero).");
    if (OTRO_PAGO_UNICO.includes(r.tipo)) unicos++;
    if (r.tipo === "002") {
      const causado = r.subsidioCausado === undefined ? -1 : num(r.subsidioCausado);
      if (causado < 0) add("conceptos", `${ref}.subsidioCausado`, "El subsidio 002 necesita el subsidio causado (puede ser 0).");
      else if (importe >= 0 && causado < importe) add("conceptos", `${ref}.subsidioCausado`, "El subsidio causado no puede ser menor al entregado (el importe).");
    }
    if (r.tipo === "004") {
      const c = r.compensacion;
      if (!c) {
        add("conceptos", `${ref}.compensacion`, "El otro pago 004 necesita los datos de CompensacionSaldosAFavor.");
      } else {
        const anioPago = Number(p.fechaPago.slice(0, 4)) || 0;
        if (num(c.saldoAFavor) <= 0) add("conceptos", `${ref}.compensacion.saldoAFavor`, "El saldo a favor debe ser mayor a cero.");
        if (!/^\d{4}$/.test(c.anio) || (anioPago > 0 && Number(c.anio) > anioPago)) add("conceptos", `${ref}.compensacion.anio`, "El año debe ser de cuatro dígitos y no posterior al del pago.");
        if (num(c.remanenteSalFav) < 0) add("conceptos", `${ref}.compensacion.remanenteSalFav`, "El remanente no es válido.");
        else if (esNumero(c.saldoAFavor) && Number(c.remanenteSalFav) > Number(c.saldoAFavor)) add("conceptos", `${ref}.compensacion.remanenteSalFav`, "El remanente no puede ser mayor al saldo a favor.");
      }
    }
  });
  if (unicos > 1) add("conceptos", "otrosPagos", "Solo puede haber un otro pago de subsidio (002, 007 u 008) por recibo.");
  if (form.percepciones.length === 0 && form.otrosPagos.length === 0) {
    add("conceptos", "percepciones", "El recibo necesita al menos una percepción o un otro pago.");
  }

  form.incapacidades.forEach((r, i) => {
    const ref = `incapacidades[${i}]`;
    if (!esEntero(r.dias) || Number(r.dias) < 1) add("extras", `${ref}.dias`, "Los días de incapacidad deben ser un entero mayor a cero.");
    if (!["01", "02", "03", "04"].includes(r.tipoIncapacidad)) add("extras", `${ref}.tipoIncapacidad`, "Elige el tipo de incapacidad.");
    if (num(r.importeMonetario) < 0) add("extras", `${ref}.importeMonetario`, "El importe de la incapacidad no es válido.");
  });
  let porcentaje = 0;
  form.subcontratacion.forEach((r, i) => {
    const ref = `subcontratacion[${i}]`;
    if (!RFC.test(r.rfcLabora)) add("extras", `${ref}.rfcLabora`, "El RFC donde labora no tiene forma de RFC.");
    const pct = num(r.porcentajeTiempo);
    if (pct <= 0 || pct > 100) add("extras", `${ref}.porcentajeTiempo`, "El porcentaje de tiempo debe estar entre 0 y 100.");
    else porcentaje += pct;
  });
  if (porcentaje > 100.0001) add("extras", "subcontratacion", "Los porcentajes de subcontratación suman más de 100.");
  if (form.relacionados) {
    const rel = form.relacionados;
    if (!/^\d{2}$/.test(rel.tipoRelacion)) add("extras", "relacionados.tipoRelacion", "Elige el tipo de relación.");
    if (rel.uuids.length === 0) add("extras", "relacionados.uuids", "Captura al menos un UUID relacionado.");
    const vistos = new Set<string>();
    rel.uuids.forEach((u, j) => {
      if (!UUID.test(u)) add("extras", `relacionados.uuids[${j}]`, `El UUID ${u} no tiene forma de folio fiscal.`);
      if (vistos.has(u)) add("extras", `relacionados.uuids[${j}]`, `El UUID ${u} está repetido.`);
      vistos.add(u);
    });
  }

  return e;
}

/** El primer mensaje de un campo, para pintarlo bajo el input. */
export function mensajeDe(problemas: ProblemaManual[], campo: string): string | null {
  return problemas.find((p) => p.campo === campo)?.mensaje ?? null;
}

/* -------------------------------------------------------------------------- */
/* Totales                                                                    */
/* -------------------------------------------------------------------------- */

/** Mismo redondeo que round(x, 2) en PHP para que el neto cuadre centavo a centavo. */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Espejo de NominaManual::conceptosDe(): los renglones tal como van al XML,
 * incluido el 002 en cero que se agrega solo en regímenes con subsidio.
 */
export function conceptosDe(form: NominaManualForm, empleado: Empleado | null): ConceptoRecibo[] {
  const lista: ConceptoRecibo[] = [];
  let orden = 0;
  const fila = (grupo: ConceptoRecibo["grupo"], tipo: string, clave: string, concepto: string, g: number, x: number) => {
    orden += 1;
    lista.push({
      grupo,
      tipo,
      clave,
      concepto,
      importe_gravado: String(round2(g)),
      importe_exento: String(round2(x)),
      orden: String(orden),
    });
  };
  for (const r of form.percepciones) fila("PERCEPCION", r.tipo, r.clave, r.concepto, Number(r.importeGravado) || 0, Number(r.importeExento) || 0);
  for (const r of form.deducciones) fila("DEDUCCION", r.tipo, r.clave, r.concepto, Number(r.importe) || 0, 0);
  let haySubsidio = false;
  for (const r of form.otrosPagos) {
    fila("OTRO_PAGO", r.tipo, r.clave, r.concepto, 0, Number(r.importe) || 0);
    if (OTRO_PAGO_UNICO.includes(r.tipo)) haySubsidio = true;
  }
  if (!haySubsidio && empleado && REGIMENES_CON_SUBSIDIO.includes(empleado.TipoRegimen)) {
    fila("OTRO_PAGO", "002", "002", "Subsidio para el empleo (efectivamente entregado al trabajador)", 0, 0);
  }
  return lista;
}

/** Si el régimen del empleado obliga a mandar el 002 y no se capturó. */
export function llevaSubsidioAutomatico(form: NominaManualForm, empleado: Empleado | null): boolean {
  return (
    !!empleado &&
    REGIMENES_CON_SUBSIDIO.includes(empleado.TipoRegimen) &&
    !form.otrosPagos.some((r) => OTRO_PAGO_UNICO.includes(r.tipo))
  );
}

export type TotalesManual = {
  percepciones: number;
  deducciones: number;
  otrosPagos: number;
  gravado: number;
  exento: number;
  sueldos: number;
  sepIndem: number;
  jubPenRet: number;
  isr: number;
  otrasDeducciones: number;
  subsidioEntregado: number;
  subTotal: number;
  descuento: number;
  neto: number;
};

/** Espejo de NominaManual::totales() más los desgloses que pinta el resumen. */
export function totalesDe(form: NominaManualForm, empleado: Empleado | null): TotalesManual {
  const t: TotalesManual = {
    percepciones: 0, deducciones: 0, otrosPagos: 0, gravado: 0, exento: 0,
    sueldos: 0, sepIndem: 0, jubPenRet: 0, isr: 0, otrasDeducciones: 0,
    subsidioEntregado: 0, subTotal: 0, descuento: 0, neto: 0,
  };
  for (const c of conceptosDe(form, empleado)) {
    const g = Number(c.importe_gravado) || 0;
    const x = Number(c.importe_exento) || 0;
    const importe = g + x;
    if (c.grupo === "PERCEPCION") {
      t.percepciones += importe;
      t.gravado += g;
      t.exento += x;
      if (SEPARACION.includes(c.tipo)) t.sepIndem += importe;
      else if (JUBILACION.includes(c.tipo)) t.jubPenRet += importe;
      else t.sueldos += importe;
    } else if (c.grupo === "DEDUCCION") {
      t.deducciones += importe;
      if (c.tipo === "002") t.isr += importe;
      else t.otrasDeducciones += importe;
    } else {
      t.otrosPagos += importe;
      if (c.tipo === "002") t.subsidioEntregado += importe;
    }
  }
  for (const k of Object.keys(t) as Array<keyof TotalesManual>) t[k] = round2(t[k]);
  t.subTotal = round2(t.percepciones + t.otrosPagos);
  t.descuento = t.deducciones;
  t.neto = round2(t.subTotal - t.descuento);
  return t;
}

/* -------------------------------------------------------------------------- */
/* Fechas                                                                     */
/* -------------------------------------------------------------------------- */

function parseISO(s: string): Date | null {
  if (!FECHA.test(s)) return null;
  const [y, m, d] = s.split("-").map(Number);
  const f = new Date(y, m - 1, d);
  return Number.isNaN(f.getTime()) ? null : f;
}

/** Días naturales entre dos fechas, ambas incluidas ("" si no se puede). */
export function diasEntre(ini: string, fin: string): string {
  const a = parseISO(ini);
  const b = parseISO(fin);
  if (!a || !b || b < a) return "";
  return String(Math.round((b.getTime() - a.getTime()) / 86_400_000) + 1);
}

/**
 * La antigüedad como la calcula NominaCfdi (espejo de `antiguedadYMD` en
 * PHP, que es la cuenta que el PAC exige exacta): en semanas cumplidas hasta
 * el cierre del periodo, o los días transcurridos contando el de ingreso
 * repartidos en años de 365 y meses de 30. Vista previa, nada más: el valor
 * que va al XML lo pone el servidor.
 */
export function antiguedad(inicio: string, hasta: string, formato: AntiguedadFormato): string | null {
  if (formato === "NINGUNA") return null;
  const ini = parseISO(inicio.slice(0, 10));
  const fin = parseISO(hasta.slice(0, 10));
  if (!ini || !fin || fin < ini || inicio.startsWith("0000")) return null;
  const diasTranscurridos = Math.round((fin.getTime() - ini.getTime()) / 86_400_000);
  if (formato === "W") {
    return `P${Math.floor((diasTranscurridos + 1) / 7)}W`;
  }
  const dias = diasTranscurridos + 1;
  const anios = Math.floor(dias / 365);
  let resto = dias - anios * 365;
  const meses = Math.floor(resto / 30);
  resto -= meses * 30;
  return `P${anios > 0 ? `${Math.min(99, anios)}Y` : ""}${meses > 0 ? `${meses}M` : ""}${resto}D`;
}

/* -------------------------------------------------------------------------- */
/* Propuesta desde la ficha                                                   */
/* -------------------------------------------------------------------------- */

/** Lo que devuelve proponerReciboNominaV2, ya en la forma del recibo. */
export type PropuestaRecibo = {
  Conceptos: ConceptoRecibo[];
  HorasExtra: Array<{ Dias: string; TipoHoras: string; HorasExtra: string; ImportePagado: string }>;
  Incapacidades: Array<{ DiasIncapacidad: string; TipoIncapacidad: string; ImporteMonetario: string }>;
  Recibo: Record<string, number | string>;
  Avisos: string[];
};

/** Convierte la propuesta del motor automático en renglones del formulario. */
export function conceptosDesdePropuesta(
  p: PropuestaRecibo
): Pick<NominaManualForm, "percepciones" | "deducciones" | "otrosPagos" | "incapacidades"> {
  const percepciones: PercepcionManual[] = [];
  const deducciones: DeduccionManual[] = [];
  const otrosPagos: OtroPagoManual[] = [];
  const subsidioCausado = String(p.Recibo?.subsidio_causado ?? "0");
  for (const c of p.Conceptos) {
    if (c.grupo === "PERCEPCION") {
      const fila: PercepcionManual = {
        id: idLocal(), tipo: c.tipo, clave: c.clave, concepto: c.concepto,
        importeGravado: String(c.importe_gravado), importeExento: String(c.importe_exento),
      };
      if (c.tipo === "019" && p.HorasExtra.length > 0) {
        fila.horasExtra = p.HorasExtra.map((h) => ({
          dias: h.Dias, tipoHoras: h.TipoHoras, horasExtra: h.HorasExtra, importePagado: h.ImportePagado,
        }));
      }
      percepciones.push(fila);
    } else if (c.grupo === "DEDUCCION") {
      deducciones.push({
        id: idLocal(), tipo: c.tipo, clave: c.clave, concepto: c.concepto,
        importe: String(round2((Number(c.importe_gravado) || 0) + (Number(c.importe_exento) || 0))),
      });
    } else {
      const fila: OtroPagoManual = {
        id: idLocal(), tipo: c.tipo, clave: c.clave, concepto: c.concepto,
        importe: String(round2((Number(c.importe_gravado) || 0) + (Number(c.importe_exento) || 0))),
      };
      if (c.tipo === "002") fila.subsidioCausado = subsidioCausado;
      otrosPagos.push(fila);
    }
  }
  return {
    percepciones,
    deducciones,
    otrosPagos,
    incapacidades: p.Incapacidades.map((i) => ({
      id: idLocal(), dias: i.DiasIncapacidad, tipoIncapacidad: i.TipoIncapacidad, importeMonetario: i.ImporteMonetario,
    })),
  };
}

/** Un formulario que tenga algo capturado en conceptos. */
export function tieneConceptos(form: NominaManualForm): boolean {
  return form.percepciones.length + form.deducciones.length + form.otrosPagos.length > 0;
}
