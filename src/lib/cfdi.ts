/* ---------------------------------------------------------------------------
   Parser de CFDI 4.0
   ---------------------------------------------------------------------------
   Convierte el XML timbrado en una estructura plana para pintar el detalle de
   la factura. Usa DOMParser, así que **solo corre en el navegador**: llámalo
   desde un Client Component, nunca desde un Server Component.

   Se busca por `localName` (ignorando el prefijo del namespace) porque aunque
   la convención sea `cfdi:` / `tfd:`, el prefijo lo elige quien genera el XML y
   no es obligatorio que sea ese.
--------------------------------------------------------------------------- */

export type CfdiConcepto = {
  claveProdServ: string;
  noIdentificacion: string;
  cantidad: string;
  claveUnidad: string;
  unidad: string;
  descripcion: string;
  valorUnitario: string;
  importe: string;
  descuento: string;
  objetoImp: string;
  traslados: CfdiImpuesto[];
  retenciones: CfdiImpuesto[];
};

export type CfdiImpuesto = {
  impuesto: string;
  tipoFactor: string;
  tasaOCuota: string;
  base: string;
  importe: string;
};

/* -------------------------- Complemento de Pagos 2.0 ------------------------- */

export type CfdiDoctoRelacionado = {
  idDocumento: string;
  serie: string;
  folio: string;
  monedaDR: string;
  equivalenciaDR: string;
  numParcialidad: string;
  impSaldoAnt: string;
  impPagado: string;
  impSaldoInsoluto: string;
  objetoImpDR: string;
  trasladosDR: CfdiImpuesto[];
  retencionesDR: CfdiImpuesto[];
};

export type CfdiPago = {
  fechaPago: string;
  formaDePagoP: string;
  monedaP: string;
  tipoCambioP: string;
  monto: string;
  numOperacion: string;
  doctoRelacionado: CfdiDoctoRelacionado[];
};

export type CfdiPagos = {
  version: string;
  totales: {
    totalRetencionesIVA: string;
    totalRetencionesISR: string;
    totalRetencionesIEPS: string;
    totalTrasladosBaseIVA16: string;
    totalTrasladosImpuestoIVA16: string;
    totalTrasladosBaseIVA8: string;
    totalTrasladosImpuestoIVA8: string;
    totalTrasladosBaseIVA0: string;
    totalTrasladosImpuestoIVA0: string;
    totalTrasladosBaseIVAExento: string;
    montoTotalPagos: string;
  };
  pagos: CfdiPago[];
};

/* -------------------------- Complemento de Nómina 1.2 ------------------------ */

export type CfdiPercepcion = {
  tipoPercepcion: string;
  clave: string;
  concepto: string;
  importeGravado: string;
  importeExento: string;
};

export type CfdiDeduccion = {
  tipoDeduccion: string;
  clave: string;
  concepto: string;
  importe: string;
};

export type CfdiOtroPago = {
  tipoOtroPago: string;
  clave: string;
  concepto: string;
  importe: string;
  subsidioCausado: string;
};

export type CfdiIncapacidad = {
  diasIncapacidad: string;
  tipoIncapacidad: string;
  importeMonetarioPagado: string;
};

export type CfdiNomina = {
  version: string;
  tipoNomina: string;
  fechaPago: string;
  fechaInicialPago: string;
  fechaFinalPago: string;
  numDiasPagados: string;
  totalPercepciones: string;
  totalDeducciones: string;
  totalOtrosPagos: string;
  emisor: { registroPatronal: string; curp: string; rfcPatronOrigen: string };
  receptor: {
    curp: string;
    numSeguridadSocial: string;
    fechaInicioRelLaboral: string;
    antiguedad: string;
    tipoContrato: string;
    sindicalizado: string;
    tipoJornada: string;
    tipoRegimen: string;
    numEmpleado: string;
    departamento: string;
    puesto: string;
    riesgoPuesto: string;
    periodicidadPago: string;
    banco: string;
    cuentaBancaria: string;
    salarioBaseCotApor: string;
    salarioDiarioIntegrado: string;
    claveEntFed: string;
  };
  percepciones: {
    totalSueldos: string;
    totalGravado: string;
    totalExento: string;
    totalSeparacionIndemnizacion: string;
    totalJubilacionPensionRetiro: string;
    lista: CfdiPercepcion[];
    separacionIndemnizacion: {
      totalPagado: string;
      numAñosServicio: string;
      ultimoSueldoMensOrd: string;
      ingresoAcumulable: string;
      ingresoNoAcumulable: string;
    } | null;
    jubilacionPensionRetiro: {
      totalUnaExhibicion: string;
      totalParcialidad: string;
      montoDiario: string;
      ingresoAcumulable: string;
      ingresoNoAcumulable: string;
    } | null;
  };
  deducciones: {
    totalOtrasDeducciones: string;
    totalImpuestosRetenidos: string;
    lista: CfdiDeduccion[];
  };
  otrosPagos: CfdiOtroPago[];
  incapacidades: CfdiIncapacidad[];
};

export type Cfdi = {
  version: string;
  serie: string;
  folio: string;
  fecha: string;
  formaPago: string;
  metodoPago: string;
  moneda: string;
  tipoCambio: string;
  subTotal: string;
  descuento: string;
  total: string;
  tipoDeComprobante: string;
  exportacion: string;
  lugarExpedicion: string;
  condicionesDePago: string;
  noCertificado: string;
  sello: string;
  emisor: { rfc: string; nombre: string; regimenFiscal: string };
  receptor: {
    rfc: string;
    nombre: string;
    domicilioFiscal: string;
    regimenFiscal: string;
    usoCfdi: string;
  };
  conceptos: CfdiConcepto[];
  totalTrasladados: string;
  totalRetenidos: string;
  traslados: CfdiImpuesto[];
  retenciones: CfdiImpuesto[];
  pagos: CfdiPagos | null;
  nomina: CfdiNomina | null;
  timbre: {
    uuid: string;
    fechaTimbrado: string;
    rfcProvCertif: string;
    noCertificadoSAT: string;
    selloCFD: string;
    selloSAT: string;
    version: string;
  } | null;
};

function hijos(nodo: Element | null, localName: string): Element[] {
  if (!nodo) return [];
  return Array.from(nodo.children).filter((el) => el.localName === localName);
}

function primerDescendiente(raiz: Element, localName: string): Element | null {
  if (raiz.localName === localName) return raiz;
  for (const hijo of Array.from(raiz.children)) {
    const encontrado = primerDescendiente(hijo, localName);
    if (encontrado) return encontrado;
  }
  return null;
}

function attr(el: Element | null, nombre: string): string {
  return el?.getAttribute(nombre) ?? "";
}

function impuestosDe(padre: Element | null, grupo: string, item: string): CfdiImpuesto[] {
  const contenedor = hijos(padre, "Impuestos")[0] ?? null;
  const lista = hijos(contenedor, grupo)[0] ?? null;
  return hijos(lista, item).map((el) => ({
    impuesto: attr(el, "Impuesto"),
    tipoFactor: attr(el, "TipoFactor"),
    tasaOCuota: attr(el, "TasaOCuota"),
    base: attr(el, "Base"),
    importe: attr(el, "Importe"),
  }));
}

function impuestosDrDe(doctoEl: Element | null, grupo: string, item: string): CfdiImpuesto[] {
  const contenedor = hijos(doctoEl, "ImpuestosDR")[0] ?? null;
  const lista = hijos(contenedor, grupo)[0] ?? null;
  return hijos(lista, item).map((el) => ({
    impuesto: attr(el, "ImpuestoDR"),
    tipoFactor: attr(el, "TipoFactorDR"),
    tasaOCuota: attr(el, "TasaOCuotaDR"),
    base: attr(el, "BaseDR"),
    importe: attr(el, "ImporteDR"),
  }));
}

/** Complemento de Pagos 2.0 (namespace pago20:), si el comprobante lo trae. */
function parsePagos(root: Element): CfdiPagos | null {
  const pagosEl = primerDescendiente(root, "Pagos");
  if (!pagosEl) return null;

  const totalesEl = hijos(pagosEl, "Totales")[0] ?? null;

  return {
    version: attr(pagosEl, "Version"),
    totales: {
      totalRetencionesIVA: attr(totalesEl, "TotalRetencionesIVA"),
      totalRetencionesISR: attr(totalesEl, "TotalRetencionesISR"),
      totalRetencionesIEPS: attr(totalesEl, "TotalRetencionesIEPS"),
      totalTrasladosBaseIVA16: attr(totalesEl, "TotalTrasladosBaseIVA16"),
      totalTrasladosImpuestoIVA16: attr(totalesEl, "TotalTrasladosImpuestoIVA16"),
      totalTrasladosBaseIVA8: attr(totalesEl, "TotalTrasladosBaseIVA8"),
      totalTrasladosImpuestoIVA8: attr(totalesEl, "TotalTrasladosImpuestoIVA8"),
      totalTrasladosBaseIVA0: attr(totalesEl, "TotalTrasladosBaseIVA0"),
      totalTrasladosImpuestoIVA0: attr(totalesEl, "TotalTrasladosImpuestoIVA0"),
      totalTrasladosBaseIVAExento: attr(totalesEl, "TotalTrasladosBaseIVAExento"),
      montoTotalPagos: attr(totalesEl, "MontoTotalPagos"),
    },
    pagos: hijos(pagosEl, "Pago").map((pagoEl) => ({
      fechaPago: attr(pagoEl, "FechaPago"),
      formaDePagoP: attr(pagoEl, "FormaDePagoP"),
      monedaP: attr(pagoEl, "MonedaP"),
      tipoCambioP: attr(pagoEl, "TipoCambioP"),
      monto: attr(pagoEl, "Monto"),
      numOperacion: attr(pagoEl, "NumOperacion"),
      doctoRelacionado: hijos(pagoEl, "DoctoRelacionado").map((d) => ({
        idDocumento: attr(d, "IdDocumento"),
        serie: attr(d, "Serie"),
        folio: attr(d, "Folio"),
        monedaDR: attr(d, "MonedaDR"),
        equivalenciaDR: attr(d, "EquivalenciaDR"),
        numParcialidad: attr(d, "NumParcialidad"),
        impSaldoAnt: attr(d, "ImpSaldoAnt"),
        impPagado: attr(d, "ImpPagado"),
        impSaldoInsoluto: attr(d, "ImpSaldoInsoluto"),
        objetoImpDR: attr(d, "ObjetoImpDR"),
        trasladosDR: impuestosDrDe(d, "TrasladosDR", "TrasladoDR"),
        retencionesDR: impuestosDrDe(d, "RetencionesDR", "RetencionDR"),
      })),
    })),
  };
}

/** Complemento de Nómina 1.2 (namespace nomina12:), si el comprobante lo trae. */
function parseNomina(root: Element): CfdiNomina | null {
  const nominaEl = primerDescendiente(root, "Nomina");
  if (!nominaEl) return null;

  const emisorEl = hijos(nominaEl, "Emisor")[0] ?? null;
  const receptorEl = hijos(nominaEl, "Receptor")[0] ?? null;
  const percepcionesEl = hijos(nominaEl, "Percepciones")[0] ?? null;
  const deduccionesEl = hijos(nominaEl, "Deducciones")[0] ?? null;
  const otrosPagosEl = hijos(nominaEl, "OtrosPagos")[0] ?? null;
  const incapacidadesEl = hijos(nominaEl, "Incapacidades")[0] ?? null;

  const separacionEl = hijos(percepcionesEl, "SeparacionIndemnizacion")[0] ?? null;
  const jubilacionEl = hijos(percepcionesEl, "JubilacionPensionRetiro")[0] ?? null;

  const otrosPagos = hijos(otrosPagosEl, "OtroPago").map((el) => {
    const subsidioEl = hijos(el, "SubsidioAlEmpleo")[0] ?? null;
    return {
      tipoOtroPago: attr(el, "TipoOtroPago"),
      clave: attr(el, "Clave"),
      concepto: attr(el, "Concepto"),
      importe: attr(el, "Importe"),
      subsidioCausado: subsidioEl ? attr(subsidioEl, "SubsidioCausado") : "",
    };
  });

  return {
    version: attr(nominaEl, "Version"),
    tipoNomina: attr(nominaEl, "TipoNomina"),
    fechaPago: attr(nominaEl, "FechaPago"),
    fechaInicialPago: attr(nominaEl, "FechaInicialPago"),
    fechaFinalPago: attr(nominaEl, "FechaFinalPago"),
    numDiasPagados: attr(nominaEl, "NumDiasPagados"),
    totalPercepciones: attr(nominaEl, "TotalPercepciones"),
    totalDeducciones: attr(nominaEl, "TotalDeducciones"),
    totalOtrosPagos: attr(nominaEl, "TotalOtrosPagos"),
    emisor: {
      registroPatronal: attr(emisorEl, "RegistroPatronal"),
      curp: attr(emisorEl, "Curp"),
      rfcPatronOrigen: attr(emisorEl, "RfcPatronOrigen"),
    },
    receptor: {
      curp: attr(receptorEl, "Curp"),
      numSeguridadSocial: attr(receptorEl, "NumSeguridadSocial"),
      fechaInicioRelLaboral: attr(receptorEl, "FechaInicioRelLaboral"),
      antiguedad: attr(receptorEl, "Antigüedad"),
      tipoContrato: attr(receptorEl, "TipoContrato"),
      sindicalizado: attr(receptorEl, "Sindicalizado"),
      tipoJornada: attr(receptorEl, "TipoJornada"),
      tipoRegimen: attr(receptorEl, "TipoRegimen"),
      numEmpleado: attr(receptorEl, "NumEmpleado"),
      departamento: attr(receptorEl, "Departamento"),
      puesto: attr(receptorEl, "Puesto"),
      riesgoPuesto: attr(receptorEl, "RiesgoPuesto"),
      periodicidadPago: attr(receptorEl, "PeriodicidadPago"),
      banco: attr(receptorEl, "Banco"),
      cuentaBancaria: attr(receptorEl, "CuentaBancaria"),
      salarioBaseCotApor: attr(receptorEl, "SalarioBaseCotApor"),
      salarioDiarioIntegrado: attr(receptorEl, "SalarioDiarioIntegrado"),
      claveEntFed: attr(receptorEl, "ClaveEntFed"),
    },
    percepciones: {
      totalSueldos: attr(percepcionesEl, "TotalSueldos"),
      totalGravado: attr(percepcionesEl, "TotalGravado"),
      totalExento: attr(percepcionesEl, "TotalExento"),
      totalSeparacionIndemnizacion: attr(percepcionesEl, "TotalSeparacionIndemnizacion"),
      totalJubilacionPensionRetiro: attr(percepcionesEl, "TotalJubilacionPensionRetiro"),
      lista: hijos(percepcionesEl, "Percepcion").map((el) => ({
        tipoPercepcion: attr(el, "TipoPercepcion"),
        clave: attr(el, "Clave"),
        concepto: attr(el, "Concepto"),
        importeGravado: attr(el, "ImporteGravado"),
        importeExento: attr(el, "ImporteExento"),
      })),
      separacionIndemnizacion: separacionEl
        ? {
            totalPagado: attr(separacionEl, "TotalPagado"),
            numAñosServicio: attr(separacionEl, "NumAñosServicio"),
            ultimoSueldoMensOrd: attr(separacionEl, "UltimoSueldoMensOrd"),
            ingresoAcumulable: attr(separacionEl, "IngresoAcumulable"),
            ingresoNoAcumulable: attr(separacionEl, "IngresoNoAcumulable"),
          }
        : null,
      jubilacionPensionRetiro: jubilacionEl
        ? {
            totalUnaExhibicion: attr(jubilacionEl, "TotalUnaExhibicion"),
            totalParcialidad: attr(jubilacionEl, "TotalParcialidad"),
            montoDiario: attr(jubilacionEl, "MontoDiario"),
            ingresoAcumulable: attr(jubilacionEl, "IngresoAcumulable"),
            ingresoNoAcumulable: attr(jubilacionEl, "IngresoNoAcumulable"),
          }
        : null,
    },
    deducciones: {
      totalOtrasDeducciones: attr(deduccionesEl, "TotalOtrasDeducciones"),
      totalImpuestosRetenidos: attr(deduccionesEl, "TotalImpuestosRetenidos"),
      lista: hijos(deduccionesEl, "Deduccion").map((el) => ({
        tipoDeduccion: attr(el, "TipoDeduccion"),
        clave: attr(el, "Clave"),
        concepto: attr(el, "Concepto"),
        importe: attr(el, "Importe"),
      })),
    },
    otrosPagos,
    incapacidades: hijos(incapacidadesEl, "Incapacidad").map((el) => ({
      diasIncapacidad: attr(el, "DiasIncapacidad"),
      tipoIncapacidad: attr(el, "TipoIncapacidad"),
      importeMonetarioPagado: attr(el, "ImporteMonetarioPagado"),
    })),
  };
}

/** Lanza si el XML no es un Comprobante válido. */
export function parseCfdi(xml: string): Cfdi {
  const doc = new DOMParser().parseFromString(xml, "application/xml");

  if (doc.getElementsByTagName("parsererror").length > 0) {
    throw new Error("El XML del CFDI no se pudo leer");
  }

  const root = doc.documentElement;
  if (!root || root.localName !== "Comprobante") {
    throw new Error("El XML no parece ser un CFDI");
  }

  const emisor = hijos(root, "Emisor")[0] ?? null;
  const receptor = hijos(root, "Receptor")[0] ?? null;
  const conceptosNodo = hijos(root, "Conceptos")[0] ?? null;
  const impuestosNodo = hijos(root, "Impuestos")[0] ?? null;

  const timbreEl = primerDescendiente(root, "TimbreFiscalDigital");

  return {
    version: attr(root, "Version"),
    serie: attr(root, "Serie"),
    folio: attr(root, "Folio"),
    fecha: attr(root, "Fecha"),
    formaPago: attr(root, "FormaPago"),
    metodoPago: attr(root, "MetodoPago"),
    moneda: attr(root, "Moneda"),
    tipoCambio: attr(root, "TipoCambio"),
    subTotal: attr(root, "SubTotal"),
    descuento: attr(root, "Descuento"),
    total: attr(root, "Total"),
    tipoDeComprobante: attr(root, "TipoDeComprobante"),
    exportacion: attr(root, "Exportacion"),
    lugarExpedicion: attr(root, "LugarExpedicion"),
    condicionesDePago: attr(root, "CondicionesDePago"),
    noCertificado: attr(root, "NoCertificado"),
    sello: attr(root, "Sello"),
    emisor: {
      rfc: attr(emisor, "Rfc"),
      nombre: attr(emisor, "Nombre"),
      regimenFiscal: attr(emisor, "RegimenFiscal"),
    },
    receptor: {
      rfc: attr(receptor, "Rfc"),
      nombre: attr(receptor, "Nombre"),
      domicilioFiscal: attr(receptor, "DomicilioFiscalReceptor"),
      regimenFiscal: attr(receptor, "RegimenFiscalReceptor"),
      usoCfdi: attr(receptor, "UsoCFDI"),
    },
    conceptos: hijos(conceptosNodo, "Concepto").map((el) => ({
      claveProdServ: attr(el, "ClaveProdServ"),
      noIdentificacion: attr(el, "NoIdentificacion"),
      cantidad: attr(el, "Cantidad"),
      claveUnidad: attr(el, "ClaveUnidad"),
      unidad: attr(el, "Unidad"),
      descripcion: attr(el, "Descripcion"),
      valorUnitario: attr(el, "ValorUnitario"),
      importe: attr(el, "Importe"),
      descuento: attr(el, "Descuento"),
      objetoImp: attr(el, "ObjetoImp"),
      traslados: impuestosDe(el, "Traslados", "Traslado"),
      retenciones: impuestosDe(el, "Retenciones", "Retencion"),
    })),
    totalTrasladados: attr(impuestosNodo, "TotalImpuestosTrasladados"),
    totalRetenidos: attr(impuestosNodo, "TotalImpuestosRetenidos"),
    traslados: impuestosDe(root, "Traslados", "Traslado"),
    retenciones: impuestosDe(root, "Retenciones", "Retencion"),
    pagos: parsePagos(root),
    nomina: parseNomina(root),
    timbre: timbreEl
      ? {
          uuid: attr(timbreEl, "UUID"),
          fechaTimbrado: attr(timbreEl, "FechaTimbrado"),
          rfcProvCertif: attr(timbreEl, "RfcProvCertif"),
          noCertificadoSAT: attr(timbreEl, "NoCertificadoSAT"),
          selloCFD: attr(timbreEl, "SelloCFD"),
          selloSAT: attr(timbreEl, "SelloSAT"),
          version: attr(timbreEl, "Version"),
        }
      : null,
  };
}

/** Decodifica el base64 del backend a texto XML (maneja acentos UTF-8). */
export function base64AXml(base64: string): string {
  const binario = atob(base64);
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

const FORMATO_MONEDA = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
});

export function money(valor: string | number, moneda = "MXN"): string {
  const n = typeof valor === "number" ? valor : parseFloat(valor);
  if (!Number.isFinite(n)) return "—";
  if (moneda && moneda !== "MXN") {
    return `${new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(n)} ${moneda}`;
  }
  return FORMATO_MONEDA.format(n);
}

/** "2026-08-19T14:03:11" → "19 ago 2026, 14:03" */
export function fechaHora(valor: string): string {
  if (!valor) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(valor.trim());
  if (!m) return valor;
  const d = new Date(
    Number(m[1]),
    Number(m[2]) - 1,
    Number(m[3]),
    Number(m[4]),
    Number(m[5])
  );
  return d.toLocaleString("es-MX", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
