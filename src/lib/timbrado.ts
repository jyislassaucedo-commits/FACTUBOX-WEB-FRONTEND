import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { getCurrentUser } from "./currentUser";
import { activos, totalesLocales, type ComplementosBorrador } from "./complementos";
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
  /** Número de operación del banco, si se capturó. */
  numOperacion?: string;
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
  /** Varios pagos en el mismo complemento (el asistente web). */
  pagos?: PagoInput[];
  /** "YYYY-MM-DDTHH:mm:ss" en hora de México. Sin ella, la de este momento. */
  fecha?: string;
  /** Sin ella, MXN. */
  moneda?: string;
  /** Solo cuenta si la moneda no es MXN. */
  tipoCambio?: string;
  /** c_Exportacion. Sin ella, "01". */
  exportacion?: string;
  /**
   * La que eligió el usuario. Sin ella, a Público en general se le pone la de
   * siempre (diaria, del mes en curso), que es lo que ya hacía la autofactura.
   */
  informacionGlobal?: { periodicidad: string; meses: string; anio: string };
  /** Complementos activos: id del registro (lib/complementos.ts) → datos. */
  complementos?: ComplementosBorrador;
  /** Texto libre del usuario; va en la addenda SistemaLocal. */
  observaciones?: string;
  /**
   * La addenda ya armada. La llena el SERVIDOR (ver completarAddenda) con el
   * usuario de la sesión: nunca se toma la que venga del cliente.
   */
  addenda?: { usuario: string; fecha: string; hora: string; observaciones: string };
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
 * Arma el JSON del complemento de Pagos 2.0, con uno o varios Pago y uno o
 * varios DoctoRelacionado en cada uno.
 *
 * La forma sigue la de endpoint/lib/plantillas/PLANTILLA_PAGO.php, que ya
 * timbra complementos de N pagos × M documentos, y el orden de Pagos20.xsd:
 *
 *  - Retenciones antes que traslados, en ImpuestosDR y en ImpuestosP.
 *    JSON_CFDI40 escribe los nodos en el orden de las llaves.
 *  - RetencionP lleva SOLO ImpuestoP e ImporteP (el esquema no admite más).
 *  - ImpuestosP va en la moneda del pago: cada impuesto del documento se
 *    divide entre su EquivalenciaDR.
 *  - Totales va en pesos: lo del pago por su TipoCambioP. MontoTotalPagos es
 *    Σ Monto × TipoCambioP, que es lo que revisa REGLAS_CFDI40.
 *  - Un traslado Exento no lleva tasa ni importe y suma a
 *    TotalTrasladosBaseIVAExento.
 *
 * Verificado corriendo JSON_CFDI40->crearXML(): cada nivel plural es un
 * objeto envoltorio { claveSingular: [...] }.
 */
const ORDEN_TOTALES = [
  "TotalRetencionesIVA",
  "TotalRetencionesISR",
  "TotalRetencionesIEPS",
  "TotalTrasladosBaseIVA16",
  "TotalTrasladosImpuestoIVA16",
  "TotalTrasladosBaseIVA8",
  "TotalTrasladosImpuestoIVA8",
  "TotalTrasladosBaseIVA0",
  "TotalTrasladosImpuestoIVA0",
  "TotalTrasladosBaseIVAExento",
] as const;

function buildDatosJSONPago(input: NuevaFacturaInput, pagos: PagoInput[]) {
  const fechaISO = fechaLocalMexico(new Date());
  const totales: Record<string, number> = {};
  const sumar = (clave: string, valor: number) => {
    totales[clave] = (totales[clave] ?? 0) + valor;
  };
  let montoTotalPagos = 0;

  function nodoDR(imp: ImpuestoPagoInput) {
    const exento = imp.tipoFactor === "Exento";
    return {
      BaseDR: imp.base,
      ImpuestoDR: imp.impuesto,
      TipoFactorDR: imp.tipoFactor,
      ...(exento ? {} : { TasaOCuotaDR: imp.tasaOCuota, ImporteDR: imp.importe }),
    };
  }

  const pagosJSON = pagos.map((pago) => {
    const tc = parseFloat(pago.tipoCambioP) || 1;
    type Acum = { impuesto: string; tipoFactor: string; tasa: string; base: number; importe: number; conEquivalencia: boolean };
    const trasladosP = new Map<string, Acum>();
    const retencionesP = new Map<string, Acum>();

    const doctosJSON = pago.doctoRelacionado.map((d) => {
      const eq = parseFloat(d.equivalenciaDR) || 1;
      for (const t of d.trasladosDR) {
        const clave = `${t.impuesto}|${t.tipoFactor}|${t.tasaOCuota}`;
        const acc = trasladosP.get(clave) ?? { impuesto: t.impuesto, tipoFactor: t.tipoFactor, tasa: t.tasaOCuota, base: 0, importe: 0, conEquivalencia: false };
        if (eq !== 1) acc.conEquivalencia = true;
        acc.base += parseFloat(t.base) / eq;
        acc.importe += (parseFloat(t.importe) || 0) / eq;
        trasladosP.set(clave, acc);
      }
      for (const r of d.retencionesDR) {
        // En el pago, la retención se agrupa solo por impuesto.
        const acc = retencionesP.get(r.impuesto) ?? { impuesto: r.impuesto, tipoFactor: r.tipoFactor, tasa: "", base: 0, importe: 0, conEquivalencia: false };
        if (eq !== 1) acc.conEquivalencia = true;
        acc.importe += (parseFloat(r.importe) || 0) / eq;
        retencionesP.set(r.impuesto, acc);
      }

      const impuestosDR: Record<string, unknown> = {};
      if (d.retencionesDR.length > 0) impuestosDR.RetencionesDR = { RetencionDR: d.retencionesDR.map(nodoDR) };
      if (d.trasladosDR.length > 0) impuestosDR.TrasladosDR = { TrasladoDR: d.trasladosDR.map(nodoDR) };

      return {
        IdDocumento: d.idDocumento,
        ...(d.serie ? { Serie: d.serie } : {}),
        ...(d.folio ? { Folio: d.folio } : {}),
        MonedaDR: d.monedaDR,
        // Va siempre: el PAC la exige aunque el esquema la marque opcional.
        EquivalenciaDR: d.equivalenciaDR || "1",
        NumParcialidad: d.numParcialidad,
        ImpSaldoAnt: d.impSaldoAnt,
        ImpPagado: d.impPagado,
        ImpSaldoInsoluto: d.impSaldoInsoluto,
        ObjetoImpDR: d.objetoImpDR,
        ...(Object.keys(impuestosDR).length > 0 ? { ImpuestosDR: impuestosDR } : {}),
      };
    });

    /*
       El SAT acepta ImporteP dentro de Σ(ImporteDR ± 0.005) / EquivalenciaDR.
       Con equivalencia 1 eso es exacto a centavos; con una mayor a 1 (pago en
       dólares de una factura en pesos: 18.5) el margen es de milésimas y dos
       decimales se salen. Ahí va con seis, que el esquema permite.
    */
    const importeP = (a: Acum) => (a.conEquivalencia ? Math.round(a.importe * 1e6) / 1e6 : round2(a.importe));
    const textoImporteP = (a: Acum, n: number) => n.toFixed(a.conEquivalencia ? 6 : 2);

    const impuestosP: Record<string, unknown> = {};
    if (retencionesP.size > 0) {
      impuestosP.RetencionesP = {
        RetencionP: [...retencionesP.values()].map((r) => {
          const importe = importeP(r);
          const campo = { [IMPUESTO_IVA]: "TotalRetencionesIVA", [IMPUESTO_ISR]: "TotalRetencionesISR", [IMPUESTO_IEPS]: "TotalRetencionesIEPS" }[r.impuesto];
          if (campo) sumar(campo, importe * tc);
          return { ImpuestoP: r.impuesto, ImporteP: textoImporteP(r, importe) };
        }),
      };
    }
    if (trasladosP.size > 0) {
      impuestosP.TrasladosP = {
        TrasladoP: [...trasladosP.values()].map((t) => {
          const exento = t.tipoFactor === "Exento";
          const importe = importeP(t);
          if (t.impuesto === IMPUESTO_IVA) {
            if (exento) sumar("TotalTrasladosBaseIVAExento", t.base * tc);
            else {
              const sufijo = { "0.160000": "16", "0.080000": "8", "0.000000": "0" }[parseFloat(t.tasa).toFixed(6)];
              if (sufijo) {
                sumar(`TotalTrasladosBaseIVA${sufijo}`, t.base * tc);
                sumar(`TotalTrasladosImpuestoIVA${sufijo}`, importe * tc);
              }
            }
          }
          return {
            BaseP: t.base.toFixed(6),
            ImpuestoP: t.impuesto,
            TipoFactorP: t.tipoFactor,
            ...(exento ? {} : { TasaOCuotaP: t.tasa, ImporteP: textoImporteP(t, importe) }),
          };
        }),
      };
    }

    montoTotalPagos += round2((parseFloat(pago.monto) || 0) * tc);

    return {
      FechaPago: pago.fechaPago,
      FormaDePagoP: pago.formaDePagoP,
      MonedaP: pago.monedaP,
      // Va siempre, también en pesos: el PAC la exige.
      TipoCambioP: pago.monedaP === "MXN" ? "1" : pago.tipoCambioP || "1",
      Monto: (parseFloat(pago.monto) || 0).toFixed(2),
      ...(pago.numOperacion ? { NumOperacion: pago.numOperacion } : {}),
      DoctoRelacionado: doctosJSON,
      ...(Object.keys(impuestosP).length > 0 ? { ImpuestosP: impuestosP } : {}),
    };
  });

  const totalesJSON: Record<string, string> = {};
  for (const clave of ORDEN_TOTALES) {
    if (totales[clave] !== undefined) totalesJSON[clave] = round2(totales[clave]).toFixed(2);
  }
  totalesJSON.MontoTotalPagos = round2(montoTotalPagos).toFixed(2);

  const esRfcGenerico = input.receptorRfc === RECEPTOR_PUBLICO_GENERAL.Rfc;

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
    ...(input.cfdiRelacionados && input.cfdiRelacionados.uuids.length > 0
      ? {
          CfdiRelacionados: [
            {
              TipoRelacion: input.cfdiRelacionados.tipoRelacion,
              CfdiRelacionado: input.cfdiRelacionados.uuids.map((uuid) => ({ UUID: uuid })),
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
      // Con el RFC genérico el SAT exige el CP del emisor.
      DomicilioFiscalReceptor: esRfcGenerico ? input.lugarExpedicion : input.receptorDomicilioFiscal,
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
        Totales: totalesJSON,
        Pago: pagosJSON,
      },
    },
    ...(input.addenda
      ? {
          Addenda: {
            SistemaLocal: {
              UsuarioDeSistema: input.addenda.usuario,
              Fecha: input.addenda.fecha,
              Hora: input.addenda.hora,
              Observaciones: input.addenda.observaciones,
            },
          },
        }
      : {}),
  };
}

// Arma el JSON CFDI 4.0 que espera JSON_CFDI40 (mismo formato usado por el
// timbrado existente), calculando totales e impuestos globales a partir de
// los conceptos capturados. Exportada porque la autofactura por QR arma el
// mismo comprobante (el backend le quita el Receptor).
export function buildDatosJSON(input: NuevaFacturaInput) {
  if (input.tipoDeComprobante === "P") {
    const pagos = input.pagos ?? (input.pago ? [input.pago] : []);
    if (pagos.length > 0) return buildDatosJSONPago(input, pagos);
  }

  const ahora = new Date();
  const fechaISO = input.fecha || fechaLocalMexico(ahora);
  const moneda = input.moneda || "MXN";
  // Con MXN el SAT exige TipoCambio 1; con otra moneda, el que se capturó.
  const tipoCambio = moneda === "MXN" ? "1" : input.tipoCambio || "1";

  // Los complementos de concepto (iedu) van dentro de cada Concepto; los del
  // comprobante, en el nodo Complemento. Vienen del mismo registro que la
  // pantalla usa para pedirlos.
  const complementosActivos = activos(input.complementos);
  const deConcepto = complementosActivos.filter((c) => c.destino === "concepto");
  const deComprobante = complementosActivos.filter((c) => c.destino === "comprobante");

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
      // Después de Impuestos: el esquema pone ComplementoConcepto al final
      // del Concepto, y JSON_CFDI40 respeta el orden de las llaves.
      ...(deConcepto.length > 0
        ? {
            ComplementoConcepto: Object.fromEntries(
              deConcepto.map((def) => [def.nodo, def.aJson(input.complementos![def.id], { subtotal: 0 })])
            ),
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
  // Los impuestos locales (implocal) se suman o restan al Total además de
  // los federales; es como los cuenta el SAT y como los revisa REGLAS_CFDI40.
  const locales = totalesLocales(input.complementos, round2(subTotal));
  const total = round2(
    subTotal + totalTrasladados - totalRetenidos + locales.traslados - locales.retenciones
  );

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
    Moneda: moneda,
    FormaPago: input.formaPago,
    MetodoPago: input.metodoPago,
    TipoCambio: tipoCambio,
    Total: total.toFixed(2),
    TipoDeComprobante: input.tipoDeComprobante,
    Exportacion: input.exportacion || "01",
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
    // La llave es "Año", con ñ: JSON_CFDI40 no reconoce "Anio".
    ...(llevaInformacionGlobal
      ? {
          InformacionGlobal: input.informacionGlobal
            ? {
                Periodicidad: input.informacionGlobal.periodicidad,
                Meses: input.informacionGlobal.meses,
                Año: input.informacionGlobal.anio,
              }
            : {
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
    ...(deComprobante.length > 0
      ? {
          Complemento: Object.fromEntries(
            deComprobante.map((def) => [
              def.nodo,
              def.aJson(input.complementos![def.id], { subtotal: round2(subTotal) }),
            ])
          ),
        }
      : {}),
    // Las observaciones van como en el escritorio: <cfdi:SistemaLocal> dentro
    // de la Addenda. No las revisa el SAT ni entran al sello.
    ...(input.addenda
      ? {
          Addenda: {
            SistemaLocal: {
              UsuarioDeSistema: input.addenda.usuario,
              Fecha: input.addenda.fecha,
              Hora: input.addenda.hora,
              Observaciones: input.addenda.observaciones,
            },
          },
        }
      : {}),
  };
}

/**
 * Arma la addenda de observaciones con datos del servidor: el usuario de la
 * sesión y la fecha y hora de ahora, en hora de México y con el formato del
 * escritorio ("dd/mm/aaaa" y "HH:mm:ss"). Cualquier addenda que mande el
 * cliente se descarta.
 */
async function completarAddenda(input: NuevaFacturaInput): Promise<NuevaFacturaInput> {
  const observaciones = (input.observaciones ?? "").replace(/\s+/g, " ").trim();
  if (!observaciones) return { ...input, addenda: undefined };

  const usuario = await getCurrentUser().catch(() => null);
  const ahora = fechaLocalMexico(new Date());
  return {
    ...input,
    addenda: {
      usuario: usuario?.Nombre || usuario?.Usuario || usuario?.Email || "",
      fecha: `${ahora.slice(8, 10)}/${ahora.slice(5, 7)}/${ahora.slice(0, 4)}`,
      hora: ahora.slice(11, 19),
      observaciones,
    },
  };
}

export type TimbrarResult = {
  UUID: string;
  FechaTimbrado: string;
  CFDI_Base64: string;
};

/** Un hallazgo del validador: el campo del CFDI y qué tiene de malo. */
export type HallazgoSat = {
  campo: string;
  mensaje: string;
};

export type ValidarResult = {
  /** "1" si el comprobante pasaría el filtro del PAC. */
  Valido: "0" | "1";
  Validacion: {
    /** El SAT lo rechazaría: hay que corregir antes de timbrar. */
    Errores: HallazgoSat[];
    /** Conviene revisarlo, pero no impide timbrar. */
    Advertencias: HallazgoSat[];
    /** Capas que no se pudieron correr, con el motivo. */
    NoRevisado: string[];
  };
};

/**
 * Ensaya el timbrado sin timbrar: el backend arma y sella el comprobante y lo
 * revisa contra los esquemas, catálogos y reglas del SAT. No habla con el PAC
 * y no descuenta timbres.
 *
 * Vale la pena aunque `validar` de facturaNueva.ts ya haya pasado: esa revisa
 * el borrador, y esto revisa el XML que de verdad va a recibir el SAT, ya
 * armado y sellado.
 */
export async function validarFactura(
  emisorToken: string,
  input: NuevaFacturaInput
): Promise<PhpResponse<ValidarResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON = buildDatosJSON(await completarAddenda(input));
  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<ValidarResult>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "VALIDACION",
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });
}

export async function timbrarFactura(
  emisorToken: string,
  input: NuevaFacturaInput
): Promise<PhpResponse<TimbrarResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON = buildDatosJSON(await completarAddenda(input));
  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<TimbrarResult>("/endpoint/apiTimbradoV2.php", {
    SessionToken: session.token,
    Token: emisorToken,
    Tarea: "TIMBRADO",
    ModoTimbrado: MODO_TIMBRADO,
    DatosJSON: datosJSON64,
  });
}
