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
