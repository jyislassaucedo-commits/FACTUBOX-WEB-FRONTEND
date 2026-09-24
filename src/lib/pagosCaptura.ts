/* ---------------------------------------------------------------------------
   Captura de un complemento de pago con varios pagos y varias facturas.
   ---------------------------------------------------------------------------
   SIN "use client" y sin dependencias de servidor: lo usa la pantalla (qué
   falta, cuánto queda) y el cuerpo que se manda a timbrar.

   El usuario arma cada pago: elige qué facturas cubre y cuánto paga de cada
   una. Aquí no se reparte nada solo; lo único que se sugiere es el saldo de
   la factura como importe, y el usuario lo cambia.
--------------------------------------------------------------------------- */

import type { DoctoRelacionadoInput, ImpuestoPagoInput, PagoInput } from "@/lib/timbrado";
import type { Cfdi } from "@/lib/cfdi";

export type ImpuestoFactura = {
  impuesto: string;
  tipoFactor: string;
  tasaOCuota: string;
  base: number;
  importe: number;
};

export type PagoPrevioFactura = {
  serieFolio: string;
  fechaPago: string;
  parcialidad: number;
  pagado: number;
  insoluto: number;
};

/** Una factura PPD que se puede pagar, venga de Factubox o de un XML. */
export type FacturaPagable = {
  uuid: string;
  serie: string;
  folio: string;
  fecha: string;
  total: number;
  moneda: string;
  receptor: { rfc: string; nombre: string; regimen: string; cp: string };
  origen: "factubox" | "xml";
  /** Impuestos de los conceptos, sumados por impuesto+factor+tasa. */
  traslados: ImpuestoFactura[];
  retenciones: ImpuestoFactura[];
  /** Pagos ya timbrados en Factubox. */
  previos: PagoPrevioFactura[];
  /** De un XML de fuera: el último complemento que la incluye, si se cargó. */
  complementoPrevio: { archivo: string; parcialidad: number; insoluto: number } | null;
  /** Nombre del archivo, si vino de un XML. */
  archivo?: string;
};

/** Cómo sigue una factura que ya tenía pagos. */
export type Decision = "ultimo" | "cero" | "primero" | "complemento";

export type DoctoCaptura = {
  uuid: string;
  /** Lo que se paga de esta factura, en la moneda del pago. */
  importe: number;
  /** Unidades de la moneda de la factura por una de la del pago. */
  equivalencia: number;
};

export type PagoCaptura = {
  id: string;
  /** "YYYY-MM-DD" */
  fecha: string;
  /** "HH:mm" */
  hora: string;
  forma: string;
  moneda: string;
  tipoCambio: number;
  /** Solo cuenta si montoManual; si no, el monto es la suma de las facturas. */
  monto: number;
  montoManual: boolean;
  numOperacion: string;
  docs: DoctoCaptura[];
};

export type CapturaPagos = {
  pagos: PagoCaptura[];
  facturas: Record<string, FacturaPagable>;
  decisiones: Record<string, Decision>;
};

export const CAPTURA_VACIA: CapturaPagos = { pagos: [], facturas: {}, decisiones: {} };

export function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
function trunc2(n: number) {
  return Math.floor(round2(n * 100) / 100 * 100 + 1e-7) / 100;
}

/* -------------------------------------------------------------------------- */
/* Saldos y parcialidades                                                     */
/* -------------------------------------------------------------------------- */

/** Parcialidad y saldo con que empieza una factura, según su historial y la decisión. */
export function inicio(f: FacturaPagable, decision?: Decision) {
  // El complemento que el usuario subió manda: es su forma de decir "el
  // último pago se hizo fuera de Factubox".
  if (decision === "complemento" && f.complementoPrevio) {
    return { parcialidad: f.complementoPrevio.parcialidad + 1, saldo: f.complementoPrevio.insoluto };
  }
  if (f.previos.length > 0 && decision !== "cero") {
    // Vienen de la primera a la última (ver PAGO_DOCTO_SERVICE::pagosDe): con dos
    // cadenas que chocan en la misma parcialidad, manda la que llega después.
    const ultimo = f.previos.reduce((a, b) => (b.parcialidad >= a.parcialidad ? b : a));
    return { parcialidad: ultimo.parcialidad + 1, saldo: ultimo.insoluto };
  }
  if (f.complementoPrevio && decision !== "primero") {
    return { parcialidad: f.complementoPrevio.parcialidad + 1, saldo: f.complementoPrevio.insoluto };
  }
  return { parcialidad: 1, saldo: f.total };
}

export function montoDe(p: PagoCaptura) {
  return p.montoManual ? p.monto : sumaImportes(p);
}
export function sumaImportes(p: PagoCaptura) {
  return round2(p.docs.reduce((s, d) => s + d.importe, 0));
}

/** Lo que se paga de la factura, en su moneda. */
export function pagadoEnFactura(d: DoctoCaptura) {
  return trunc2(d.importe * d.equivalencia);
}

export function ordenarPagos(pagos: PagoCaptura[]) {
  return [...pagos].sort((a, b) => `${a.fecha}${a.hora}${a.id}`.localeCompare(`${b.fecha}${b.hora}${b.id}`));
}

export type Tramo = { saldoAnterior: number; pagado: number; insoluto: number; parcialidad: number };

/**
 * Encadena saldo y parcialidad de cada factura a través de los pagos, por
 * fecha de pago. Si la misma factura aparece en dos pagos, el segundo empieza
 * donde terminó el primero. Clave del resultado: `${idPago}|${uuid}`.
 */
export function cadena(c: CapturaPagos, pagos: PagoCaptura[] = c.pagos): Record<string, Tramo> {
  const saldo: Record<string, number> = {};
  const parc: Record<string, number> = {};
  const res: Record<string, Tramo> = {};
  for (const p of ordenarPagos(pagos)) {
    for (const d of p.docs) {
      const f = c.facturas[d.uuid];
      if (!f) continue;
      if (!(d.uuid in saldo)) {
        const i = inicio(f, c.decisiones[d.uuid]);
        saldo[d.uuid] = i.saldo;
        parc[d.uuid] = i.parcialidad - 1;
      }
      const ant = saldo[d.uuid];
      let pagado = pagadoEnFactura(d);
      // Con equivalencia, liquidar puede pasarse unos centavos por redondeo.
      if (pagado > ant && pagado - ant <= toleranciaDe(d)) pagado = ant;
      parc[d.uuid] += 1;
      res[`${p.id}|${d.uuid}`] = { saldoAnterior: ant, pagado, insoluto: round2(ant - pagado), parcialidad: parc[d.uuid] };
      saldo[d.uuid] = round2(ant - pagado);
    }
  }
  return res;
}

/**
 * Lo que le queda a una factura contando los pagos ya armados, menos uno (el
 * que se edita). Usa lo pagado según la cadena, con el ajuste de centavos que
 * deja una equivalencia al liquidar.
 */
export function saldoDisponible(c: CapturaPagos, uuid: string, excluir?: string | null) {
  const f = c.facturas[uuid];
  if (!f) return 0;
  const otros = c.pagos.filter((p) => p.id !== excluir);
  const tramos = cadena(c, otros);
  let s = inicio(f, c.decisiones[uuid]).saldo;
  for (const p of otros) {
    const t = tramos[`${p.id}|${uuid}`];
    if (t) s = round2(s - t.pagado);
  }
  return s;
}

/** Cuánto puede pasarse lo pagado del saldo por redondear la equivalencia. */
export function toleranciaDe(d: DoctoCaptura) {
  return Math.max(0.01, d.equivalencia * 0.01);
}

/** Equivalencia que se propone entre la moneda de la factura y la del pago. */
export function equivalenciaDefecto(monedaPago: string, tipoCambioPago: number, monedaFactura: string) {
  if (monedaFactura === monedaPago) return 1;
  // Pago en dólares de una factura en pesos: cada dólar son TC pesos.
  if (monedaFactura === "MXN") return tipoCambioPago || 0;
  // Pago en pesos de una factura en dólares: la equivalencia la captura el usuario.
  return 0;
}

/* -------------------------------------------------------------------------- */
/* La regla de receptores, en un solo lugar                                   */
/* -------------------------------------------------------------------------- */
/*
   Un complemento lleva facturas de UN receptor. Si el usuario mezcla, no se
   bloquea: el pago se divide en uno por receptor y cada receptor tiene su
   propio complemento, con advertencia. Cuando llegue el factoraje (a nombre
   de terceros), esta es la regla que cambia.
*/
export function mismoReceptor(a: FacturaPagable, b: FacturaPagable) {
  return a.receptor.rfc === b.receptor.rfc;
}

export function receptorDePago(c: CapturaPagos, p: PagoCaptura) {
  const f = p.docs.length ? c.facturas[p.docs[0].uuid] : undefined;
  return f?.receptor ?? null;
}

export function receptoresDe(c: CapturaPagos, uuids: string[]) {
  const rfcs: string[] = [];
  for (const u of uuids) {
    const r = c.facturas[u]?.receptor.rfc;
    if (r && !rfcs.includes(r)) rfcs.push(r);
  }
  return rfcs;
}

export type ComplementoCaptura = {
  receptor: FacturaPagable["receptor"];
  pagos: PagoCaptura[];
};

/** Un complemento por receptor, en el orden en que aparecieron. */
export function complementosPorReceptor(c: CapturaPagos): ComplementoCaptura[] {
  const orden: ComplementoCaptura[] = [];
  for (const p of c.pagos) {
    const r = receptorDePago(c, p);
    if (!r) continue;
    let comp = orden.find((x) => x.receptor.rfc === r.rfc);
    if (!comp) {
      comp = { receptor: r, pagos: [] };
      orden.push(comp);
    }
    comp.pagos.push(p);
  }
  return orden;
}

/**
 * Al guardar un pago con facturas de varios receptores se divide en uno por
 * receptor, con los mismos datos. Devuelve los pagos resultantes.
 */
export function dividirPorReceptor(c: CapturaPagos, p: PagoCaptura, nuevoId: () => string): PagoCaptura[] {
  const rfcs = receptoresDe(c, p.docs.map((d) => d.uuid));
  if (rfcs.length <= 1) return [p];
  return rfcs.map((rfc, i) => {
    const docs = p.docs.filter((d) => c.facturas[d.uuid]?.receptor.rfc === rfc);
    const parte: PagoCaptura = { ...p, id: i === 0 ? p.id : nuevoId(), docs, montoManual: false };
    parte.monto = sumaImportes(parte);
    return parte;
  });
}

export function totalEnPesos(pagos: PagoCaptura[]) {
  return round2(pagos.reduce((s, p) => s + round2(montoDe(p) * (p.moneda === "MXN" ? 1 : p.tipoCambio)), 0));
}

/* -------------------------------------------------------------------------- */
/* Qué falta en un pago                                                       */
/* -------------------------------------------------------------------------- */

export type ProblemasPago = { errores: string[]; avisos: string[] };

export function folioDe(f: Pick<FacturaPagable, "serie" | "folio" | "uuid">) {
  return f.serie || f.folio ? [f.serie, f.folio].filter(Boolean).join("-") : f.uuid.slice(0, 8);
}

export function problemasDePago(c: CapturaPagos, p: PagoCaptura): ProblemasPago {
  const errores: string[] = [];
  const avisos: string[] = [];
  if (p.docs.length === 0) errores.push("Elige al menos una factura para este pago.");
  if (!p.fecha) errores.push("Falta la fecha del pago.");
  if (!p.forma) errores.push("Falta la forma de pago.");
  if (p.moneda !== "MXN" && !(p.tipoCambio > 0)) errores.push("Falta el tipo de cambio del pago.");

  // Se revisa en orden de fecha, con este pago en su lugar: lo que importa es
  // cuánto le quedaba a la factura cuando llegó, y que al final no se pase.
  const todos = [...c.pagos.filter((x) => x.id !== p.id), p];
  const tramos = cadena(c, todos);
  for (const d of p.docs) {
    const f = c.facturas[d.uuid];
    if (!f) continue;
    const t = tramos[`${p.id}|${d.uuid}`];
    if (!(d.equivalencia > 0)) errores.push(`${folioDe(f)}: falta la equivalencia entre ${f.moneda} y ${p.moneda}.`);
    if (!(d.importe > 0)) errores.push(`${folioDe(f)}: el importe debe ser mayor a 0.`);
    else if (t && pagadoEnFactura(d) - t.saldoAnterior > toleranciaDe(d)) {
      errores.push(
        `${folioDe(f)}: pagas ${pagadoEnFactura(d).toFixed(2)} ${f.moneda} y a esa fecha solo le quedaban ${t.saldoAnterior.toFixed(2)}.`
      );
    } else {
      // Un pago posterior de la misma factura puede quedar pasado por este.
      const pasada = todos.some((x) =>
        x.docs.some((y) => {
          if (y.uuid !== d.uuid || x.id === p.id) return false;
          const tx = tramos[`${x.id}|${y.uuid}`];
          return tx && pagadoEnFactura(y) - tx.saldoAnterior > toleranciaDe(y);
        })
      );
      if (pasada) errores.push(`${folioDe(f)}: con este pago, otro pago posterior de la factura queda pagando más que su saldo.`);
    }
  }

  const monto = montoDe(p);
  const dif = round2(monto - sumaImportes(p));
  if (!(monto > 0)) errores.push("Falta el monto del pago.");
  if (dif < -0.004) errores.push(`Las facturas suman ${sumaImportes(p).toFixed(2)}, más que el monto de ${monto.toFixed(2)} ${p.moneda}.`);
  if (dif > 0.004) avisos.push(`Sobran ${dif.toFixed(2)} ${p.moneda} del pago sin aplicar a ninguna factura. Se puede timbrar así.`);

  const rfcs = receptoresDe(c, p.docs.map((d) => d.uuid));
  if (rfcs.length > 1) {
    const nombres = rfcs.map((r) => Object.values(c.facturas).find((f) => f.receptor.rfc === r)?.receptor.nombre ?? r);
    avisos.push(
      `Este pago tiene facturas de ${rfcs.length} receptores (${nombres.join(", ")}). Un complemento solo lleva un receptor: al guardarlo se dividirá en ${rfcs.length} pagos, uno por receptor, y cada uno irá en su propio complemento.`
    );
  }
  return { errores, avisos };
}

/* -------------------------------------------------------------------------- */
/* Lo que se manda a timbrar                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Prorratea los impuestos de la factura por lo pagado: la base de cada
 * impuesto se multiplica por pagado / total, igual que como se timbraron los
 * pagos parciales que ya aceptó el SAT.
 */
function prorratear(lista: ImpuestoFactura[], factor: number): ImpuestoPagoInput[] {
  return lista.map((i) => {
    const base = i.base * factor;
    const exento = i.tipoFactor === "Exento";
    const tasa = parseFloat(i.tasaOCuota) || 0;
    return {
      base: base.toFixed(6),
      impuesto: i.impuesto,
      tipoFactor: i.tipoFactor || "Tasa",
      tasaOCuota: exento ? "" : tasa.toFixed(6),
      importe: exento ? "" : round2(base * tasa).toFixed(2),
    };
  });
}

/** Los pagos de un complemento en la forma que espera buildDatosJSONPago. */
export function aPagosInput(c: CapturaPagos, pagos: PagoCaptura[]): PagoInput[] {
  const tramos = cadena(c, pagos);
  return ordenarPagos(pagos).map((p) => ({
    fechaPago: `${p.fecha}T${p.hora || "12:00"}:00`,
    formaDePagoP: p.forma,
    monedaP: p.moneda,
    tipoCambioP: p.moneda === "MXN" ? "1" : String(p.tipoCambio),
    monto: round2(montoDe(p)).toFixed(2),
    numOperacion: p.numOperacion.trim() || undefined,
    doctoRelacionado: p.docs.map((d): DoctoRelacionadoInput => {
      const f = c.facturas[d.uuid];
      const t = tramos[`${p.id}|${d.uuid}`];
      const factor = f.total > 0 ? t.pagado / f.total : 0;
      const trasladosDR = prorratear(f.traslados, factor);
      const retencionesDR = prorratear(f.retenciones, factor);
      return {
        idDocumento: f.uuid,
        serie: f.serie,
        folio: f.folio,
        monedaDR: f.moneda,
        equivalenciaDR: f.moneda === p.moneda ? "1" : String(d.equivalencia),
        numParcialidad: String(t.parcialidad),
        impSaldoAnt: t.saldoAnterior.toFixed(2),
        impPagado: t.pagado.toFixed(2),
        impSaldoInsoluto: t.insoluto.toFixed(2),
        objetoImpDR: trasladosDR.length > 0 || retencionesDR.length > 0 ? "02" : "01",
        trasladosDR,
        retencionesDR,
      };
    }),
  }));
}

/* -------------------------------------------------------------------------- */
/* Facturas desde las fuentes                                                 */
/* -------------------------------------------------------------------------- */

/** Lo que devuelve /api/facturas/pagos-relacionados por factura. */
export type FacturaRelacionadaApi = {
  Uuid: string;
  NoEncontrada?: boolean;
  Serie?: string;
  Folio?: string;
  Fecha?: string;
  Total?: string;
  Moneda?: string;
  MetodoPago?: string;
  Estatus?: string;
  Receptor?: { Rfc: string; Nombre: string; Regimen: string; Cp: string };
  Impuestos?: {
    Traslados: Array<{ Impuesto: string; TipoFactor: string; TasaOCuota: string; Base: string; Importe: string }>;
    Retenciones: Array<{ Impuesto: string; TipoFactor: string; TasaOCuota: string; Base: string; Importe: string }>;
  };
  PagosPrevios?: Array<{ SerieFolio: string; FechaPago: string; NumParcialidad: string; ImpPagado: string; ImpSaldoInsoluto: string }>;
};

export function desdeApi(a: FacturaRelacionadaApi): FacturaPagable | null {
  if (a.NoEncontrada || !a.Receptor) return null;
  const imp = (x: { Impuesto: string; TipoFactor: string; TasaOCuota: string; Base: string; Importe: string }): ImpuestoFactura => ({
    impuesto: x.Impuesto,
    tipoFactor: x.TipoFactor || "Tasa",
    tasaOCuota: x.TasaOCuota,
    base: parseFloat(x.Base) || 0,
    importe: parseFloat(x.Importe) || 0,
  });
  return {
    uuid: a.Uuid.toUpperCase(),
    serie: a.Serie ?? "",
    folio: a.Folio ?? "",
    fecha: (a.Fecha ?? "").slice(0, 10),
    total: parseFloat(a.Total ?? "0") || 0,
    moneda: a.Moneda || "MXN",
    receptor: { rfc: a.Receptor.Rfc, nombre: a.Receptor.Nombre, regimen: a.Receptor.Regimen, cp: a.Receptor.Cp },
    origen: "factubox",
    traslados: (a.Impuestos?.Traslados ?? []).map(imp),
    retenciones: (a.Impuestos?.Retenciones ?? []).map(imp),
    previos: (a.PagosPrevios ?? []).map((p) => ({
      serieFolio: p.SerieFolio,
      fechaPago: p.FechaPago,
      parcialidad: parseInt(p.NumParcialidad, 10) || 0,
      pagado: parseFloat(p.ImpPagado) || 0,
      insoluto: parseFloat(p.ImpSaldoInsoluto) || 0,
    })),
    complementoPrevio: null,
  };
}

/** Resultado de revisar un XML soltado por el usuario. */
export type RevisionXml =
  | { estado: "lista"; factura: FacturaPagable }
  | { estado: "rechazada"; motivo: string };

/**
 * Convierte un CFDI leído en el navegador (parseCfdi) en una factura pagable,
 * o dice por qué no sirve. Los impuestos salen de los conceptos, sumados por
 * impuesto+factor+tasa, igual que en pagosRelacionadosWeb.php.
 */
export function desdeXml(cfdi: Cfdi, archivo: string, rfcEmisor: string): RevisionXml {
  if (!cfdi.timbre?.uuid) return { estado: "rechazada", motivo: "No está timbrado" };
  if (cfdi.tipoDeComprobante !== "I") return { estado: "rechazada", motivo: `No es factura de ingreso (tipo ${cfdi.tipoDeComprobante || "?"})` };
  if (cfdi.metodoPago !== "PPD") return { estado: "rechazada", motivo: `Es ${cfdi.metodoPago || "sin método"}: no lleva complemento de pago` };
  if (cfdi.emisor.rfc.toUpperCase() !== rfcEmisor.toUpperCase()) return { estado: "rechazada", motivo: `Es de otro emisor (${cfdi.emisor.rfc})` };

  const acumular = (origen: "traslados" | "retenciones") => {
    const mapa = new Map<string, ImpuestoFactura>();
    for (const c of cfdi.conceptos) {
      for (const i of c[origen]) {
        const clave = `${i.impuesto}|${i.tipoFactor}|${i.tasaOCuota}`;
        const acc = mapa.get(clave) ?? { impuesto: i.impuesto, tipoFactor: i.tipoFactor || "Tasa", tasaOCuota: i.tasaOCuota, base: 0, importe: 0 };
        acc.base += parseFloat(i.base) || 0;
        acc.importe += parseFloat(i.importe) || 0;
        mapa.set(clave, acc);
      }
    }
    return [...mapa.values()];
  };

  return {
    estado: "lista",
    factura: {
      uuid: cfdi.timbre.uuid.toUpperCase(),
      serie: cfdi.serie,
      folio: cfdi.folio,
      fecha: cfdi.fecha.slice(0, 10),
      total: parseFloat(cfdi.total) || 0,
      moneda: cfdi.moneda || "MXN",
      receptor: {
        rfc: cfdi.receptor.rfc,
        nombre: cfdi.receptor.nombre,
        regimen: cfdi.receptor.regimenFiscal,
        cp: cfdi.receptor.domicilioFiscal,
      },
      origen: "xml",
      traslados: acumular("traslados"),
      retenciones: acumular("retenciones"),
      previos: [],
      complementoPrevio: null,
      archivo,
    },
  };
}

/**
 * Del XML de un complemento de pago anterior, la última parcialidad que
 * incluye esta factura. null si el complemento no la menciona.
 */
export function ultimaParcialidadEn(cfdi: Cfdi, uuid: string, archivo: string) {
  let mejor: { archivo: string; parcialidad: number; insoluto: number } | null = null;
  for (const p of cfdi.pagos?.pagos ?? []) {
    for (const d of p.doctoRelacionado) {
      if (d.idDocumento.toUpperCase() !== uuid.toUpperCase()) continue;
      const parc = parseInt(d.numParcialidad, 10) || 0;
      if (!mejor || parc > mejor.parcialidad) mejor = { archivo, parcialidad: parc, insoluto: parseFloat(d.impSaldoInsoluto) || 0 };
    }
  }
  return mejor;
}

const NOMBRE_TIPO: Record<string, string> = {
  I: "una factura de ingreso",
  E: "una nota de crédito (egreso)",
  N: "un recibo de nómina",
  T: "un comprobante de traslado",
};

export type RevisionComplementoPrevio =
  | { estado: "listo"; previo: NonNullable<FacturaPagable["complementoPrevio"]> }
  | { estado: "rechazado"; motivo: string };

/**
 * ¿Sirve este XML como "el último pago que se hizo en otro sistema" de la
 * factura? Tiene que ser un complemento de pago (tipo P) timbrado, del mismo
 * emisor y receptor, que incluya la factura y le deje saldo.
 */
export function revisarComplementoPrevio(
  cfdi: Cfdi | null,
  archivo: string,
  f: FacturaPagable,
  rfcEmisor: string
): RevisionComplementoPrevio {
  const no = (motivo: string): RevisionComplementoPrevio => ({ estado: "rechazado", motivo });
  if (!cfdi || !cfdi.tipoDeComprobante) return no("no es un CFDI.");
  if (cfdi.tipoDeComprobante !== "P") {
    return no(`es ${NOMBRE_TIPO[cfdi.tipoDeComprobante] ?? `un comprobante tipo ${cfdi.tipoDeComprobante}`}, no un complemento de pago (tipo P).`);
  }
  if (!cfdi.timbre?.uuid) return no("no está timbrado.");
  if (cfdi.emisor.rfc.toUpperCase() !== rfcEmisor.toUpperCase()) return no(`es de otro emisor (${cfdi.emisor.rfc}).`);
  if (f.receptor.rfc && cfdi.receptor.rfc.toUpperCase() !== f.receptor.rfc.toUpperCase()) {
    return no(`es de otro receptor (${cfdi.receptor.rfc}).`);
  }
  const previo = ultimaParcialidadEn(cfdi, f.uuid, archivo);
  if (!previo) return no(`no incluye la factura ${folioDe(f)}.`);
  if (previo.insoluto <= 0.004) return no("con ese complemento la factura ya quedó pagada (saldo 0).");
  return { estado: "listo", previo };
}

/** Si Factubox tiene un pago más adelante que el complemento subido, cuál. */
export function pagoPosteriorEnFactubox(f: FacturaPagable) {
  if (!f.complementoPrevio || f.previos.length === 0) return null;
  const max = Math.max(...f.previos.map((p) => p.parcialidad));
  return max > f.complementoPrevio.parcialidad ? max : null;
}

/** Lo que devuelve /api/facturas/por-pagar: PPD con saldo, por receptor. */
export type PorPagar = {
  Receptores: Array<{ Rfc: string; Nombre: string; Facturas: number; Saldos: Record<string, string> }>;
  Facturas: Array<{
    Uuid: string;
    Serie: string;
    Folio: string;
    Fecha: string;
    Total: string;
    Moneda: string;
    Saldo: string;
    RfcReceptor: string;
  }>;
};
