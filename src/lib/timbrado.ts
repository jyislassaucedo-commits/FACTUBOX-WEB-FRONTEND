import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import {
  IMPUESTO_IEPS,
  IMPUESTO_ISR,
  IMPUESTO_IVA,
  RECEPTOR_PUBLICO_GENERAL,
} from "./catalogosSat";

const MODO_TIMBRADO = process.env.MODO_TIMBRADO || "PRUEBAS";

/** Un concepto puede llevar varios impuestos: IVA e IEPS trasladados, y por
 * separado IVA, IEPS o ISR retenidos. La única regla es que no se repita la
 * misma tasa dentro del mismo impuesto+naturaleza (ver `validar` en
 * facturaNueva.ts). */
export type NaturalezaImpuesto = "traslado" | "retencion";

export type ImpuestoConceptoInput = {
  /** Identificador estable para la fila en la UI; no se manda al SAT. */
  id: string;
  tipo: string; // c_Impuesto: IMPUESTO_IVA | IMPUESTO_IEPS | IMPUESTO_ISR
  naturaleza: NaturalezaImpuesto;
  tasa: string; // "0.160000", nunca "" (exento = no hay fila para ese impuesto)
};

export type ConceptoInput = {
  descripcion: string;
  claveProdServ: string;
  claveUnidad: string;
  unidad: string;
  cantidad: number;
  valorUnitario: number;
  impuestos: ImpuestoConceptoInput[];
};

/** Tipos de comprobante que esta pantalla sabe armar hoy. */
export type TipoComprobante = "I" | "E" | "P";

/**
 * Documento(s) que este CFDI relaciona. Para una nota de crédito (Egreso) el
 * SAT espera TipoRelacion "01" apuntando a la factura que corrige.
 */
export type CfdiRelacionadosInput = {
  tipoRelacion: string;
  uuids: string[];
};

/** Un traslado o retención dentro de un DoctoRelacionado (sufijo *DR) o del
 * Pago mismo (sufijo *P): mismos campos en ambos casos. */
export type ImpuestoPagoInput = {
  base: string;
  impuesto: string;
  tipoFactor: string;
  tasaOCuota: string;
  importe: string;
};

/** Documento que este pago salda, total o parcialmente. */
export type DoctoRelacionadoInput = {
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
  trasladosDR: ImpuestoPagoInput[];
  retencionesDR: ImpuestoPagoInput[];
};

/** Hoy el asistente arma un solo <Pago> con un solo <DoctoRelacionado> por
 * comprobante - pagar varias facturas en un mismo evento queda para más
 * adelante. */
export type PagoInput = {
  fechaPago: string;
  formaDePagoP: string;
  monedaP: string;
  tipoCambioP: string;
  monto: string;
  doctoRelacionado: DoctoRelacionadoInput[];
};

export type NuevaFacturaInput = {
  tipoDeComprobante: TipoComprobante;
  cfdiRelacionados?: CfdiRelacionadosInput;
  rfcEmisor: string;
  nombreEmisor: string;
  regimenEmisor: string;
  lugarExpedicion: string;
  serie: string;
  folio: string;
  formaPago: string;
  metodoPago: string;
  condicionesDePago?: string;
  receptorRfc: string;
  receptorNombre: string;
  receptorRegimenFiscal: string;
  receptorDomicilioFiscal: string;
  receptorUsoCfdi: string;
  conceptos: ConceptoInput[];
  /** Solo para tipoDeComprobante "P". */
  pago?: PagoInput;
};

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// El atributo Fecha del CFDI debe ir en hora LOCAL de Mexico (no UTC) - el
// PAC valida que este dentro de un rango cercano a "ahora" y rechaza con
// "Fecha y hora de generacion fuera de rango" si se manda en UTC (~6-7
// horas adelantado respecto a Mexico).
function fechaLocalMexico(fecha: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mexico_City",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(fecha);
  const obtener = (tipo: string) => partes.find((p) => p.type === tipo)?.value ?? "00";
  return `${obtener("year")}-${obtener("month")}-${obtener("day")}T${obtener("hour")}:${obtener("minute")}:${obtener("second")}`;
}

/**
 * Arma el JSON del complemento de Pagos 2.0. Verificado corriendo
 * JSON_CFDI40->crearXML() directamente (Tarea "ARMADO", que no timbra ni
 * consume nada) contra este mismo armado: la forma correcta es "objeto
 * envoltorio { claveSingular: [...] }" en cada nivel plural - igual patrón
 * que Conceptos.Concepto e Impuestos.Traslados.Traslado en el otro camino
 * de esta función, NO un arreglo plano como el que trae algún JSON de
 * ejemplo suelto en el repo (ese es de una versión distinta del backend).
 */
function buildDatosJSONPago(input: NuevaFacturaInput, pago: PagoInput) {
  const fechaISO = fechaLocalMexico(new Date());

  const trasladosTotales = new Map<string, { impuesto: string; tasa: string; base: number; importe: number }>();
  const retencionesTotales = new Map<string, { impuesto: string; tasa: string; base: number; importe: number }>();

  function acumular(
    mapa: Map<string, { impuesto: string; tasa: string; base: number; importe: number }>,
    imp: ImpuestoPagoInput
  ) {
    const key = `${imp.impuesto}-${imp.tasaOCuota}`;
    const acc = mapa.get(key) ?? { impuesto: imp.impuesto, tasa: imp.tasaOCuota, base: 0, importe: 0 };
    acc.base += parseFloat(imp.base);
    acc.importe += parseFloat(imp.importe);
    mapa.set(key, acc);
  }

  function nodoImpuesto(imp: ImpuestoPagoInput, sufijo: "DR" | "P") {
    return {
      [`Base${sufijo}`]: imp.base,
      [`Impuesto${sufijo}`]: imp.impuesto,
      [`TipoFactor${sufijo}`]: imp.tipoFactor,
      [`TasaOCuota${sufijo}`]: imp.tasaOCuota,
      [`Importe${sufijo}`]: imp.importe,
    };
  }

  const doctosJSON = pago.doctoRelacionado.map((d) => {
    d.trasladosDR.forEach((t) => acumular(trasladosTotales, t));
    d.retencionesDR.forEach((t) => acumular(retencionesTotales, t));

    const impuestosDR: Record<string, unknown> = {};
    if (d.trasladosDR.length > 0) {
      impuestosDR.TrasladosDR = { TrasladoDR: d.trasladosDR.map((t) => nodoImpuesto(t, "DR")) };
    }
    if (d.retencionesDR.length > 0) {
      impuestosDR.RetencionesDR = { RetencionDR: d.retencionesDR.map((t) => nodoImpuesto(t, "DR")) };
    }

    return {
      IdDocumento: d.idDocumento,
      ...(d.serie ? { Serie: d.serie } : {}),
      ...(d.folio ? { Folio: d.folio } : {}),
      MonedaDR: d.monedaDR,
      EquivalenciaDR: d.equivalenciaDR,
      NumParcialidad: d.numParcialidad,
      ImpSaldoAnt: d.impSaldoAnt,
      ImpPagado: d.impPagado,
      ImpSaldoInsoluto: d.impSaldoInsoluto,
      ObjetoImpDR: d.objetoImpDR,
      ...(Object.keys(impuestosDR).length > 0 ? { ImpuestosDR: impuestosDR } : {}),
    };
  });

  const impuestosP: Record<string, unknown> = {};
  if (trasladosTotales.size > 0) {
    impuestosP.TrasladosP = {
      TrasladoP: [...trasladosTotales.values()].map((t) =>
        nodoImpuesto(
          { base: t.base.toFixed(6), impuesto: t.impuesto, tipoFactor: "Tasa", tasaOCuota: t.tasa, importe: round2(t.importe).toFixed(2) },
          "P"
        )
      ),
    };
  }
  if (retencionesTotales.size > 0) {
    impuestosP.RetencionesP = {
      RetencionP: [...retencionesTotales.values()].map((t) =>
        nodoImpuesto(
          { base: t.base.toFixed(6), impuesto: t.impuesto, tipoFactor: "Tasa", tasaOCuota: t.tasa, importe: round2(t.importe).toFixed(2) },
          "P"
        )
      ),
    };
  }

  const pagoJSON = {
    FechaPago: pago.fechaPago,
    FormaDePagoP: pago.formaDePagoP,
    MonedaP: pago.monedaP,
    TipoCambioP: pago.tipoCambioP || "1",
    Monto: pago.monto,
    DoctoRelacionado: doctosJSON,
    ...(Object.keys(impuestosP).length > 0 ? { ImpuestosP: impuestosP } : {}),
  };

  // Solo IVA tiene un campo dedicado por tasa en Totales (16/8/0%); ISR e
  // IEPS retenidos van en un total único sin desglose por tasa. Una tasa de
  // IVA fuera de este catálogo (rarísimo) simplemente no suma a Totales -
  // el desglose real sigue yendo en cada DoctoRelacionado/Pago.
  const SUFIJO_IVA: Record<string, string> = { "0.160000": "16", "0.080000": "8", "0.000000": "0" };
  const CAMPO_RETENCION: Record<string, string> = {
    [IMPUESTO_IVA]: "TotalRetencionesIVA",
    [IMPUESTO_ISR]: "TotalRetencionesISR",
    [IMPUESTO_IEPS]: "TotalRetencionesIEPS",
  };

  const totales: Record<string, string> = {};
  for (const t of trasladosTotales.values()) {
    if (t.impuesto !== IMPUESTO_IVA) continue;
    const sufijo = SUFIJO_IVA[t.tasa];
    if (!sufijo) continue;
    totales[`TotalTrasladosBaseIVA${sufijo}`] = t.base.toFixed(2);
    totales[`TotalTrasladosImpuestoIVA${sufijo}`] = round2(t.importe).toFixed(2);
  }
  for (const t of retencionesTotales.values()) {
    const campo = CAMPO_RETENCION[t.impuesto];
    if (!campo) continue;
    const previo = totales[campo] ? parseFloat(totales[campo]) : 0;
    totales[campo] = round2(previo + t.importe).toFixed(2);
  }
  totales.MontoTotalPagos = round2(parseFloat(pago.monto)).toFixed(2);

  return {
    Version: "4.0",
    Serie: input.serie,
    Folio: input.folio,
    Fecha: fechaISO,
    Sello: "",
    NoCertificado: "",
    Certificado: "",
    SubTotal: "0",
    Moneda: "XXX",
    Total: "0",
    TipoDeComprobante: "P",
    Exportacion: "01",
    LugarExpedicion: input.lugarExpedicion,
    Emisor: {
      Rfc: input.rfcEmisor,
      Nombre: input.nombreEmisor,
      RegimenFiscal: input.regimenEmisor,
    },
    Receptor: {
      Rfc: input.receptorRfc,
      Nombre: input.receptorNombre,
      DomicilioFiscalReceptor: input.receptorDomicilioFiscal,
      RegimenFiscalReceptor: input.receptorRegimenFiscal,
      // Fijo por catálogo del SAT: un CFDI de Pago siempre lleva CP01.
      UsoCFDI: "CP01",
    },
    // Concepto de relleno: el SAT exige al menos uno, pero en un CFDI de
    // Pago no representa nada real (Importe 0, sin objeto de impuesto).
    Conceptos: {
      Concepto: [
        {
          ClaveProdServ: "84111506",
          Cantidad: "1",
          ClaveUnidad: "ACT",
          Descripcion: "Pago",
          ValorUnitario: "0",
          Importe: "0",
          ObjetoImp: "01",
        },
      ],
    },
    Complemento: {
      Pagos: {
        Version: "2.0",
        Totales: totales,
        Pago: [pagoJSON],
      },
    },
  };
}

// Arma el JSON CFDI 4.0 que espera JSON_CFDI40 (mismo formato usado por el
// timbrado existente), calculando totales e impuestos globales a partir de
// los conceptos capturados.
function buildDatosJSON(input: NuevaFacturaInput) {
  if (input.tipoDeComprobante === "P" && input.pago) {
    return buildDatosJSONPago(input, input.pago);
  }

  const ahora = new Date();
  const fechaISO = fechaLocalMexico(ahora);

  let subTotal = 0;
  const trasladosPorTasa = new Map<string, { impuesto: string; tasa: string; base: number; importe: number }>();
  const retencionesPorTasa = new Map<string, { impuesto: string; tasa: string; base: number; importe: number }>();

  const conceptosJSON = input.conceptos.map((c) => {
    const importe = round2(c.cantidad * c.valorUnitario);
    subTotal += importe;

    const traslados: Record<string, unknown>[] = [];
    const retenciones: Record<string, unknown>[] = [];

    for (const imp of c.impuestos) {
      const importeImp = round2(importe * parseFloat(imp.tasa));
      const nodo = {
        Base: importe.toFixed(2),
        Impuesto: imp.tipo,
        TipoFactor: "Tasa",
        TasaOCuota: imp.tasa,
        Importe: importeImp.toFixed(2),
      };
      const porTasa = imp.naturaleza === "traslado" ? trasladosPorTasa : retencionesPorTasa;
      (imp.naturaleza === "traslado" ? traslados : retenciones).push(nodo);
      const key = `${imp.tipo}-${imp.tasa}`;
      const acc = porTasa.get(key) ?? { impuesto: imp.tipo, tasa: imp.tasa, base: 0, importe: 0 };
      acc.base += importe;
      acc.importe += importeImp;
      porTasa.set(key, acc);
    }

    const objetoImp = traslados.length > 0 || retenciones.length > 0 ? "02" : "01";

    return {
      // NoIdentificacion es opcional en el schema del SAT, pero si se manda
      // debe tener contenido (minLength 1) - un string vacio lo rechaza el
      // PAC con "XML mal formado" (facet minLength underrun). Se omite.
      ClaveProdServ: c.claveProdServ,
      Cantidad: String(c.cantidad),
      ClaveUnidad: c.claveUnidad,
      Unidad: c.unidad,
      Descripcion: c.descripcion,
      ValorUnitario: c.valorUnitario.toFixed(2),
      Importe: importe.toFixed(2),
      Descuento: "0.00",
      ObjetoImp: objetoImp,
      ...(traslados.length > 0 || retenciones.length > 0
        ? {
            Impuestos: {
              ...(traslados.length > 0 ? { Traslados: { Traslado: traslados } } : {}),
              ...(retenciones.length > 0 ? { Retenciones: { Retencion: retenciones } } : {}),
            },
          }
        : {}),
    };
  });

  const totalTrasladados = round2(
    [...trasladosPorTasa.values()].reduce((acc, t) => acc + t.importe, 0)
  );
  const totalRetenidos = round2(
    [...retencionesPorTasa.values()].reduce((acc, t) => acc + t.importe, 0)
  );
  const total = round2(subTotal + totalTrasladados - totalRetenidos);

  // TotalImpuestos* solo debe mandarse cuando existe el nodo hijo
  // correspondiente - declararlo en "0.00" sin Traslados/Retenciones causa
  // rechazo del SAT ("debe ser igual a la suma de los importes...").
  //
  // Orden de propiedades: a nivel Comprobante:Impuestos el schema exige
  // Retenciones antes que Traslados (al reves que dentro de cada Concepto,
  // ver cadenaoriginal_4_0.xslt lineas 376 y 389) - JSON_CFDI40.php arma
  // los nodos hijos en el orden en que aparecen aqui.
  const impuestosGlobal: Record<string, unknown> = {};
  if (retencionesPorTasa.size > 0) {
    impuestosGlobal.TotalImpuestosRetenidos = totalRetenidos.toFixed(2);
    impuestosGlobal.Retenciones = {
      Retencion: [...retencionesPorTasa.values()].map((t) => ({
        Impuesto: t.impuesto,
        Importe: t.importe.toFixed(2),
      })),
    };
  }
  if (trasladosPorTasa.size > 0) {
    impuestosGlobal.TotalImpuestosTrasladados = totalTrasladados.toFixed(2);
    impuestosGlobal.Traslados = {
      Traslado: [...trasladosPorTasa.values()].map((t) => ({
        Base: t.base.toFixed(2),
        Impuesto: t.impuesto,
        TipoFactor: "Tasa",
        TasaOCuota: t.tasa,
        Importe: t.importe.toFixed(2),
      })),
    };
  }

  // InformacionGlobal solo aplica al RFC generico de Publico en General -
  // para un receptor real (con su propio RFC) el SAT rechaza el CFDI si
  // este nodo esta presente.
  // Dos reglas distintas que NO deben mezclarse:
  //
  // 1. El RFC genérico siempre exige que DomicilioFiscalReceptor sea el CP del
  //    emisor (el receptor genérico no tiene domicilio propio).
  // 2. InformacionGlobal solo aplica a comprobantes de INGRESO a público en
  //    general (factura global); en un Egreso el SAT no la espera.
  //
  // Colapsarlas en una sola bandera dejaba el domicilio vacío en una nota de
  // crédito a público en general, y el SAT rechaza el CFDI sin ese atributo.
  const esRfcGenerico = input.receptorRfc === RECEPTOR_PUBLICO_GENERAL.Rfc;
  const llevaInformacionGlobal = esRfcGenerico && input.tipoDeComprobante === "I";
  const condicionesDePago = input.condicionesDePago?.trim() ?? "";

  return {
    Version: "4.0",
    Serie: input.serie,
    Folio: input.folio,
    Fecha: fechaISO,
    // Sello/NoCertificado/Certificado se mandan vacios a proposito: la
    // clase JSON_CFDI40 los sobreescribe ella misma en sellarXML(). En
    // cambio CondicionesDePago NO se toca despues - si se manda como
    // string vacio viola el patron del schema SAT (atributo opcional que,
    // si esta presente, no puede estar vacio) y produce "XML mal formado" -
    // por eso se omite por completo cuando el usuario no lo captura.
    Sello: "",
    NoCertificado: "",
    Certificado: "",
    ...(condicionesDePago ? { CondicionesDePago: condicionesDePago } : {}),
    SubTotal: subTotal.toFixed(2),
    Descuento: "0.00",
    Moneda: "MXN",
    FormaPago: input.formaPago,
    MetodoPago: input.metodoPago,
    TipoCambio: "1",
    Total: total.toFixed(2),
    TipoDeComprobante: input.tipoDeComprobante,
    Exportacion: "01",
    LugarExpedicion: input.lugarExpedicion,
    // El orden de las propiedades importa: JSON_CFDI40.php arma los nodos
    // del XML en el mismo orden en que aparecen aqui, y el schema CFDI 4.0
    // (ver endpoint/xslt/xslt4.0/cadenaoriginal_4_0.xslt) exige la secuencia
    // InformacionGlobal, CfdiRelacionados, Emisor, Receptor. Un orden
    // distinto produce "XML mal formado" aunque el JSON en si sea valido.
    // InformacionGlobal es obligatorio por regla del SAT (CFDI 4.0) cuando
    // el receptor es "Publico en General" (XAXX010101000), incluso para una
    // sola factura (no solo para el resumen periodico "factura global") -
    // y debe OMITIRSE cuando el receptor es real (RFC especifico).
    ...(llevaInformacionGlobal
      ? {
          InformacionGlobal: {
            Periodicidad: "01",
            Meses: fechaISO.slice(5, 7),
            Año: fechaISO.slice(0, 4),
          },
        }
      : {}),
    // CfdiRelacionados debe ser un ARREGLO: leerJson() lo pasa por
    // arrayNodoDinamico(), que solo actúa si el valor es array. El nodo
    // resultante queda entre InformacionGlobal y Emisor porque ese es el
    // orden en que la clase CFDI40 (endpoint/lib/CFDI40.php) declara sus
    // propiedades, y xmlCfdi() recorre el objeto en ese orden.
    ...(input.cfdiRelacionados && input.cfdiRelacionados.uuids.length > 0
      ? {
          CfdiRelacionados: [
            {
              TipoRelacion: input.cfdiRelacionados.tipoRelacion,
              CfdiRelacionado: input.cfdiRelacionados.uuids.map((uuid) => ({
                UUID: uuid,
              })),
            },
          ],
        }
      : {}),
    Emisor: {
      Rfc: input.rfcEmisor,
      Nombre: input.nombreEmisor,
      RegimenFiscal: input.regimenEmisor,
    },
    Receptor: {
      Rfc: input.receptorRfc,
      Nombre: input.receptorNombre,
      // Para Publico en General el SAT exige que sea el CP del propio
      // emisor; para un receptor real es su domicilio fiscal capturado.
      DomicilioFiscalReceptor: esRfcGenerico
        ? input.lugarExpedicion
        : input.receptorDomicilioFiscal,
      RegimenFiscalReceptor: input.receptorRegimenFiscal,
      UsoCFDI: input.receptorUsoCfdi,
    },
    Conceptos: { Concepto: conceptosJSON },
    Impuestos: impuestosGlobal,
  };
}

export type TimbrarResult = {
  UUID: string;
  FechaTimbrado: string;
  CFDI_Base64: string;
};

export async function timbrarFactura(
  emisorToken: string,
  input: NuevaFacturaInput
): Promise<PhpResponse<TimbrarResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON = buildDatosJSON(input);
  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<TimbrarResult>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "TIMBRADO",
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });
}
