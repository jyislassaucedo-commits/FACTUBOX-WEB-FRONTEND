/*
   JSON del CFDI (el de una prefactura) -> borrador del asistente.

   Es el camino de vuelta de buildDatosJSON + construirJson.ts, y aguanta el
   formato del escritorio (CFDIClass / JsonGenerator.vb): llaves iguales, pero
   con atributos vacíos, null donde no hay dato, números sin comillas
   ("RegimenFiscal": 601, "Año": 2025) y listas que a veces son un objeto suelto.

   Lo que la web todavía no edita (un complemento que no conoce, un impuesto
   exento o por cuota, descuentos) no se inventa: se avisa en `avisos` para
   que el usuario decida antes de abrirla, porque si la guarda o la timbra
   desde aquí eso se pierde.
*/

import {
  autotransporteVacio,
  aereoVacio,
  ferroviarioVacio,
  figuraVacia,
  maritimoVacio,
  mercanciaVacia,
  transporteVacio,
  ubicacionVacia,
  type Domicilio,
  type FiguraCP,
  type MedioCP,
  type TransporteCP,
} from "@/lib/cartaPorteShared";
import { COMPLEMENTOS, type ComplementosBorrador } from "@/lib/complementos";
import { borradorPara, type FacturaBorrador } from "@/lib/facturaNueva";
import type { ConceptoInput, ImpuestoConceptoInput, TipoComprobante } from "@/lib/timbrado";
import {
  cartaPorteNueva,
  claveLocal,
  generarIdCCP,
  mercanciaDesde,
  redondear,
  type CartaPorteBorrador,
  type MercanciaViaje,
  type UbicacionViaje,
} from "./borrador";

type Nodo = Record<string, unknown>;

/** Lo que recibe el asistente al abrir una prefactura de la nube. */
export type PrefacturaAbierta = {
  borrador: FacturaBorrador;
  /** El de la prefactura al abrirla (se sigue guardando en la misma fila); uno nuevo al duplicarla. */
  uuidLocal: string;
  /** Id de la fila en PREFACTURA; null al duplicar. */
  id: number | null;
  avisos: string[];
  /** "hh:mm" de cuando se guardó, para el pie del asistente. */
  guardada?: string;
};

export type LecturaPrefactura =
  | { ok: true; borrador: FacturaBorrador; avisos: string[] }
  | { ok: false; motivo: string };

/* -------------------------------------------------------------------------- */
/* Ayudas de lectura tolerantes                                               */
/* -------------------------------------------------------------------------- */

function obj(v: unknown): Nodo {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Nodo) : {};
}

/** Una lista del JSON: el escritorio a veces manda un objeto suelto en vez de [obj]. */
function lista(v: unknown): Nodo[] {
  if (Array.isArray(v)) return v.filter((x) => x && typeof x === "object") as Nodo[];
  if (v && typeof v === "object") return [v as Nodo];
  return [];
}

function txt(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function num(v: unknown): number {
  const n = Number(txt(v).replace(/,/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** "2026-09-25T08:00:00" -> "2026-09-25T08:00" (datetime-local). */
function aLocal(f: unknown): string {
  const s = txt(f);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s) ? s.slice(0, 16) : "";
}

function domicilioDe(d: Nodo): Domicilio {
  return {
    calle: txt(d.Calle),
    numeroexterior: txt(d.NumeroExterior),
    numerointerior: txt(d.NumeroInterior),
    colonia: txt(d.Colonia),
    localidad: txt(d.Localidad),
    referencia: txt(d.Referencia),
    municipio: txt(d.Municipio),
    estado: txt(d.Estado),
    pais: txt(d.Pais) || "MEX",
    codigopostal: txt(d.CodigoPostal),
  };
}

const EXTRANJERO = "XEXX010101000";

/* -------------------------------------------------------------------------- */
/* Carta porte                                                                */
/* -------------------------------------------------------------------------- */

const MEDIO_POR_NODO: Array<[string, MedioCP]> = [
  ["Autotransporte", "01"],
  ["TransporteMaritimo", "02"],
  ["TransporteAereo", "03"],
  ["TransporteFerroviario", "04"],
];

function transporteDe(merc: Nodo, medio: MedioCP, pesoBrutoKg: number): TransporteCP | null {
  const t = transporteVacio(medio);
  if (medio === "01") {
    const a = obj(merc.Autotransporte);
    if (!Object.keys(a).length) return null;
    const iv = obj(a.IdentificacionVehicular);
    const s = obj(a.Seguros);
    // El PesoBrutoVehicular del CFDI ya trae la carga; el del catálogo es la unidad sola.
    const unidad = Math.max(0, num(iv.PesoBrutoVehicular) - pesoBrutoKg / 1000);
    return {
      ...t,
      alias: [txt(iv.ConfigVehicular), txt(iv.PlacaVM)].filter(Boolean).join(" · "),
      permsct: txt(a.PermSCT),
      numpermisosct: txt(a.NumPermisoSCT),
      autotransporte: {
        ...autotransporteVacio(),
        configvehicular: txt(iv.ConfigVehicular),
        placavm: txt(iv.PlacaVM),
        aniomodelovm: txt(iv.AnioModeloVM),
        Pesobrutovehicular: unidad > 0 ? redondear(unidad, 2) : "",
        asegurarespcivil: txt(s.AseguraRespCivil),
        polizarespcivil: txt(s.PolizaRespCivil),
        aseguramedambiente: txt(s.AseguraMedAmbiente),
        polizamedambiente: txt(s.PolizaMedAmbiente),
        aseguracarga: txt(s.AseguraCarga),
        polizacarga: txt(s.PolizaCarga),
        primaseguro: txt(s.PrimaSeguro),
        remolques: lista(obj(a.Remolques).Remolque).map((r) => ({ subtiporem: txt(r.SubTipoRem), placa: txt(r.Placa) })),
      },
    };
  }
  if (medio === "02") {
    const m = obj(merc.TransporteMaritimo);
    if (!Object.keys(m).length) return null;
    return {
      ...t,
      alias: txt(m.NombreEmbarc) || txt(m.Matricula),
      permsct: txt(m.PermSCT),
      numpermisosct: txt(m.NumPermisoSCT),
      nombreaseg: txt(m.NombreAseg),
      numpolizaseguro: txt(m.NumPolizaSeguro),
      maritimo: {
        ...maritimoVacio(),
        tipoembarcacion: txt(m.TipoEmbarcacion),
        matricula: txt(m.Matricula),
        numeroomi: txt(m.NumeroOMI),
        nombreembarc: txt(m.NombreEmbarc),
        nacionalidadembarc: txt(m.NacionalidadEmbarc),
        unidadesdearqbruto: txt(m.UnidadesDeArqBruto),
        eslora: txt(m.Eslora),
        manga: txt(m.Manga),
        calado: txt(m.Calado),
        Puntal: txt(m.Puntal),
        lineanaviera: txt(m.LineaNaviera),
        nombreagentenaviero: txt(m.NombreAgenteNaviero),
        numautorizacionnaviero: txt(m.NumAutorizacionNaviero),
        numconocembarc: txt(m.NumConocEmbarc),
        Permisotempnavegacion: txt(m.PermisoTempNavegacion),
        contenedores: lista(m.Contenedor).map((c) => ({
          tipocontenedor: txt(c.TipoContenedor),
          matriculacontenedor: txt(c.MatriculaContenedor),
          numprecinto: txt(c.NumPrecinto),
          IdCCPRelacionado: txt(c.IdCCPRelacionado),
          PlacaVMCCP: txt(c.PlacaVMCCP),
          FechaCertificacionCCP: txt(c.FechaCertificacionCCP).slice(0, 10),
          remolques: lista(obj(c.RemolquesCCP).RemolqueCCP).map((r) => ({ SubTipoRemCCP: txt(r.SubTipoRemCCP), PlacaCCP: txt(r.PlacaCCP) })),
        })),
      },
    };
  }
  if (medio === "03") {
    const a = obj(merc.TransporteAereo);
    if (!Object.keys(a).length) return null;
    return {
      ...t,
      alias: txt(a.MatriculaAeronave),
      permsct: txt(a.PermSCT),
      numpermisosct: txt(a.NumPermisoSCT),
      nombreaseg: txt(a.NombreAseg),
      numpolizaseguro: txt(a.NumPolizaSeguro),
      aereo: {
        ...aereoVacio(),
        matriculaaeronave: txt(a.MatriculaAeronave),
        numeroguia: txt(a.NumeroGuia),
        codigotransportista: txt(a.CodigoTransportista),
        rfcembarcador: txt(a.RFCEmbarcador),
        numregidtribembarc: txt(a.NumRegIdTribEmbarc),
        residenciafiscalembarc: txt(a.ResidenciaFiscalEmbarc),
        nombreembarcador: txt(a.NombreEmbarcador),
      },
    };
  }
  const f = obj(merc.TransporteFerroviario);
  if (!Object.keys(f).length) return null;
  const carros = lista(f.Carro);
  return {
    ...t,
    alias: carros.map((c) => txt(c.MatriculaCarro)).filter(Boolean).join(", ") || "Ferroviario",
    nombreaseg: txt(f.NombreAseg),
    numpolizaseguro: txt(f.NumPolizaSeguro),
    ferroviario: {
      ...ferroviarioVacio(),
      tipodeservicio: txt(f.TipoDeServicio),
      tipodetrafico: txt(f.TipoDeTrafico),
      derechosPaso: lista(f.DerechosDePaso).map((d) => ({ tipoderechodepaso: txt(d.TipoDerechoDePaso), kilometrajepagado: txt(d.KilometrajePagado) })),
      carros: carros.map((c) => ({
        tipocarro: txt(c.TipoCarro),
        matriculacarro: txt(c.MatriculaCarro),
        guiacarro: txt(c.GuiaCarro),
        contenedores: lista(c.Contenedor).map((k) => ({ tipocontenedor: txt(k.TipoContenedor), pesocontenedorvacio: txt(k.PesoContenedorVacio) })),
      })),
    },
  };
}

function figuraDe(n: Nodo): FiguraCP {
  const dom = obj(n.Domicilio);
  const conDomicilio = Object.values(dom).some((v) => txt(v) !== "");
  const residencia = txt(n.ResidenciaFiscalFigura);
  return {
    ...figuraVacia(),
    ...(conDomicilio ? domicilioDe(dom) : {}),
    tipofigura: txt(n.TipoFigura),
    rfc: txt(n.RFCFigura),
    numlicencia: txt(n.NumLicencia),
    nombre: txt(n.NombreFigura),
    numregidtrib: txt(n.NumRegIdTribFigura),
    residenciafiscal: residencia === "MEX" ? "" : residencia,
    domicilio: conDomicilio ? "SI" : "NO",
    partes: lista(n.PartesTransporte).map((p) => ({ partetransporte: txt(p.ParteTransporte) })),
  };
}

function ubicacionDe(n: Nodo, medio: MedioCP): UbicacionViaje {
  const rfc = txt(n.RFCRemitenteDestinatario);
  const residencia = txt(n.ResidenciaFiscal);
  return {
    ...ubicacionVacia(),
    ...domicilioDe(obj(n.Domicilio)),
    tipotransporte: medio,
    rfcremdest: rfc === EXTRANJERO ? "" : rfc,
    nombreremdest: txt(n.NombreRemitenteDestinatario),
    numregidtrib: txt(n.NumRegIdTrib),
    residenciafiscal: residencia === "MEX" ? "" : residencia,
    numestacion: txt(n.NumEstacion),
    nombreestacion: txt(n.NombreEstacion),
    navegaciontrafico: txt(n.NavegacionTrafico),
    tipoestacion: txt(n.TipoEstacion),
    clave: claveLocal(),
    tipoUbicacion: txt(n.TipoUbicacion) === "Origen" ? "Origen" : "Destino",
    fechaHora: aLocal(n.FechaHoraSalidaLlegada),
    distancia: txt(n.DistanciaRecorrida),
  };
}

function mercanciaDe(n: Nodo, concepto: Nodo | undefined, paradas: Map<string, string>, avisos: Set<string>): MercanciaViaje {
  const cantidad = num(n.Cantidad);
  const peso = num(n.PesoEnKg);
  const valor = num(n.ValorMercancia);
  // El id del catálogo del escritorio va en NoIdentificacion ("MERC-0012"):
  // se conserva para que el concepto salga igual al volver a armarlo.
  const idMerc = /^MERC-(\d+)$/.exec(txt(concepto?.NoIdentificacion))?.[1];
  const base = {
    ...mercanciaVacia(),
    ...(idMerc ? { id: Number(idMerc) } : {}),
    claveprodcp: txt(n.BienesTransp),
    claveprod: txt(concepto?.ClaveProdServ) || txt(n.BienesTransp),
    descripcion: txt(n.Descripcion),
    claveuni: txt(n.ClaveUnidad),
    unidad: txt(n.Unidad),
    dimensiones: txt(n.Dimensiones),
    materialpeligroso: txt(n.MaterialPeligroso),
    clavepeligroso: txt(n.CveMaterialPeligroso),
    embalaje: txt(n.Embalaje),
    descembalaje: txt(n.DescripEmbalaje),
    pesokg: cantidad > 0 ? redondear(peso / cantidad, 6) : "",
    valor: cantidad > 0 && valor ? redondear(valor / cantidad, 6) : "0",
    moneda: txt(n.Moneda) || "MXN",
    sectorcofepris: txt(n.SectorCOFEPRIS),
    NombreIngredienteActivo: txt(n.NombreIngredienteActivo),
    NomQuimico: txt(n.NomQuimico),
    DenominacionGenericaProd: txt(n.DenominacionGenericaProd),
    DenominacionDistintivaProd: txt(n.DenominacionDistintivaProd),
    Fabricante: txt(n.Fabricante),
    FechaCaducidad: txt(n.FechaCaducidad),
    LoteMedicamento: txt(n.LoteMedicamento),
    FormaFarmaceutica: txt(n.FormaFarmaceutica),
    CondicionesEspTransp: txt(n.CondicionesEspTransp),
    RegistroSanitarioFolioAutorizacion: txt(n.RegistroSanitarioFolioAutorizacion),
    PermisoImportacion: txt(n.PermisoImportacion),
    FolioImpoVUCEM: txt(n.FolioImpoVUCEM),
    NumCAS: txt(n.NumCAS),
    RazonSocialEmpImp: txt(n.RazonSocialEmpImp),
    NumRegSanPlagCOFEPRIS: txt(n.NumRegSanPlagCOFEPRIS),
    DatosFabricante: txt(n.DatosFabricante),
    DatosFormulador: txt(n.DatosFormulador),
    DatosMaquilador: txt(n.DatosMaquilador),
    UsoAutorizado: txt(n.UsoAutorizado),
    FraccionArrancelaria: txt(n.FraccionArancelaria),
    TipoMateria: txt(n.TipoMateria),
    DescripcionMateria: txt(n.DescripcionMateria),
  };
  const m = mercanciaDesde(base, txt(n.Cantidad));
  const repartos = lista(n.CantidadTransporta).map((c) => ({
    cantidad: txt(c.Cantidad),
    origen: paradas.get(txt(c.IDOrigen)) ?? "",
    destino: paradas.get(txt(c.IDDestino)) ?? "",
  }));
  if (repartos.some((r) => !r.origen || !r.destino)) avisos.add("Algún reparto de mercancía apunta a una ubicación que la prefactura no trae; revísalo en Mercancías.");
  const det = obj(n.DetalleMercancia);
  return {
    ...m,
    pesoTotal: txt(n.PesoEnKg) || m.pesoTotal,
    uuidComercioExt: txt(n.UUIDComercioExt),
    claveSTCC: txt(n.ClaveSTCC),
    cantidadTransporta: repartos.filter((r) => r.origen && r.destino),
    documentos: lista(n.DocumentacionAduanera).map((d) => ({
      tipoDocumento: txt(d.TipoDocumento),
      numPedimento: txt(d.NumPedimento),
      idenDocAduanero: txt(d.IdentDocAduanero),
      rfcImpo: txt(d.RFCImpo),
    })),
    guias: lista(n.GuiasIdentificacion).map((g) => ({
      numero: txt(g.NumeroGuiaIdentificacion),
      descripcion: txt(g.DescripGuiaIdentificacion),
      peso: txt(g.PesoGuiaIdentificacion),
    })),
    detalle: Object.keys(det).length
      ? {
          unidadPesoMerc: txt(det.UnidadPesoMerc),
          pesoBruto: txt(det.PesoBruto),
          pesoNeto: txt(det.PesoNeto),
          pesoTara: txt(det.PesoTara),
          numPiezas: txt(det.NumPiezas),
        }
      : null,
  };
}

/** El nodo Complemento.CartaPorte -> borrador de carta porte. */
export function cartaPorteDesdeJson(nodo: Nodo, conceptosTraslado: Nodo[], avisos: Set<string>): CartaPorteBorrador {
  const version = txt(nodo.Version);
  if (version && version !== "3.1") avisos.add(`La carta porte es versión ${version}; se abre como 3.1 y hay que revisarla completa.`);
  const merc = obj(nodo.Mercancias);
  const medio = MEDIO_POR_NODO.find(([k]) => Object.keys(obj(merc[k])).length)?.[1] ?? "01";

  const ubicacionesJson = lista(obj(nodo.Ubicaciones).Ubicacion);
  const ubicaciones = ubicacionesJson.map((u) => ubicacionDe(u, medio));
  const paradas = new Map<string, string>();
  ubicacionesJson.forEach((u, i) => paradas.set(txt(u.IDUbicacion), ubicaciones[i].clave));

  const mercancias = lista(merc.Mercancia).map((m, i) => mercanciaDe(m, conceptosTraslado[i], paradas, avisos));
  const pesoBruto = mercancias.reduce((a, m) => a + (Number(m.pesoTotal) || 0), 0);
  const internacional = txt(nodo.TranspInternac) === "Sí";
  const maritimo = obj(merc.TransporteMaritimo);
  const aereo = obj(merc.TransporteAereo);

  return {
    ...cartaPorteNueva(),
    idCCP: txt(nodo.IdCCP) || generarIdCCP(),
    transpInternac: internacional ? "Sí" : "No",
    entradaSalidaMerc: internacional ? ((txt(nodo.EntradaSalidaMerc) as "Entrada" | "Salida" | "") || "") : "",
    paisOrigenDestino: txt(nodo.PaisOrigenDestino),
    regimenesAduaneros: lista(obj(nodo.RegimenesAduaneros).RegimenAduaneroCCP).map((r) => txt(r.RegimenAduanero)).filter(Boolean),
    registroISTMO: txt(nodo.RegistroISTMO) === "Sí",
    ubicacionPoloOrigen: txt(nodo.UbicacionPoloOrigen),
    ubicacionPoloDestino: txt(nodo.UbicacionPoloDestino),
    logisticaInversa: txt(merc.LogisticaInversaRecoleccionDevolucion) === "Sí",
    unidadPeso: txt(merc.UnidadPeso) || "KGM",
    medio,
    transporte: transporteDe(merc, medio, pesoBruto),
    figuras: lista(obj(nodo.FiguraTransporte).TiposFigura).map(figuraDe),
    ubicaciones,
    mercancias,
    ...(medio === "02" ? { tipoCarga: txt(maritimo.TipoCarga) } : {}),
    ...(medio === "03" ? { lugarContrato: txt(aereo.LugarContrato) } : {}),
  };
}

/* -------------------------------------------------------------------------- */
/* Comprobante                                                                */
/* -------------------------------------------------------------------------- */

function conceptoDe(n: Nodo, i: number, avisos: Set<string>): ConceptoInput {
  const imp = obj(n.Impuestos);
  const importe = num(n.Importe) || num(n.Cantidad) * num(n.ValorUnitario);
  const impuestos: ImpuestoConceptoInput[] = [];
  const leer = (nodos: Nodo[], naturaleza: "traslado" | "retencion") => {
    for (const t of nodos) {
      const factor = txt(t.TipoFactor);
      if (factor !== "Tasa") {
        avisos.add(
          factor === "Exento"
            ? "Hay conceptos con IVA exento: la web aún no maneja el exento y se abrieron sin ese impuesto."
            : `Hay impuestos de tipo ${factor || "desconocido"}: la web solo maneja tasas y se abrieron sin ellos.`
        );
        continue;
      }
      if (Math.abs(num(t.Base) - importe) > 0.01) {
        avisos.add("Algún impuesto se calculaba sobre una base distinta del importe del concepto (por ejemplo, IVA sobre el IEPS): la web lo calcula sobre el importe, así que el total cambia.");
      }
      impuestos.push({ id: `${naturaleza}-${txt(t.Impuesto)}-${i}-${impuestos.length}`, tipo: txt(t.Impuesto), naturaleza, tasa: num(t.TasaOCuota).toFixed(6) });
    }
  };
  leer(lista(obj(imp.Traslados).Traslado), "traslado");
  leer(lista(obj(imp.Retenciones).Retencion), "retencion");
  if (num(n.Descuento) > 0) avisos.add("Hay conceptos con descuento: la web aún no maneja descuentos y se abrieron sin él.");
  return {
    descripcion: txt(n.Descripcion),
    claveProdServ: txt(n.ClaveProdServ),
    claveUnidad: txt(n.ClaveUnidad),
    unidad: txt(n.Unidad),
    cantidad: num(n.Cantidad),
    valorUnitario: num(n.ValorUnitario),
    impuestos,
    ...(txt(n.NoIdentificacion) ? { noIdentificacion: txt(n.NoIdentificacion) } : {}),
  };
}

/** Complementos del comprobante que la web sabe editar; el resto se avisa. */
function complementosDe(cfdi: Nodo, conceptos: Nodo[], avisos: Set<string>): ComplementosBorrador {
  const out: ComplementosBorrador = {};
  const comp = obj(cfdi.Complemento);
  for (const [nodo, valor] of Object.entries(comp)) {
    if (nodo === "CartaPorte") continue;
    const v = obj(valor);
    if (nodo === "ImpuestosLocales") {
      // La web captura la tasa en porcentaje ("5" = 5 %); el escritorio la
      // escribe como fracción ("0.05"). El porcentaje se saca del importe.
      const subtotal = num(cfdi.SubTotal);
      const pct = (tasa: unknown, importe: unknown) => {
        const i = num(importe);
        const t = num(tasa);
        return String(subtotal > 0 && i > 0 ? Math.round((i / subtotal) * 10000) / 100 : t > 0 && t < 1 ? Math.round(t * 10000) / 100 : t);
      };
      const tras = lista(v.TrasladosLocales)[0];
      const ret = lista(v.RetencionesLocales)[0];
      if (tras) out.implocal = { impuesto: txt(tras.ImpLocTrasladado), tipo: "traslado", tasa: pct(tras.TasadeTraslado, tras.Importe) };
      else if (ret) out.implocal = { impuesto: txt(ret.ImpLocRetenido), tipo: "retencion", tasa: pct(ret.TasadeRetencion, ret.Importe) };
      if (lista(v.TrasladosLocales).length + lista(v.RetencionesLocales).length > 1) {
        avisos.add("Trae varios impuestos locales: la web maneja uno y se abrió con el primero.");
      }
      continue;
    }
    if (nodo === "LeyendasFiscales") {
      const l = lista(v.Leyenda)[0];
      if (l) out.leyendas = { disposicionFiscal: txt(l.disposicionFiscal), norma: txt(l.norma), textoLeyenda: txt(l.textoLeyenda) };
      continue;
    }
    const def = COMPLEMENTOS.find((c) => c.nodo === nodo);
    avisos.add(
      `Trae el complemento ${def?.nombre ?? nodo}, que la web todavía no edita: si la guardas o timbras desde aquí, se pierde. Ábrela en el escritorio para conservarlo.`
    );
  }
  const iedu = conceptos.map((c) => obj(obj(c.ComplementoConcepto).instEducativas)).find((x) => Object.keys(x).length);
  if (iedu) {
    out.iedu = {
      nombreAlumno: txt(iedu.nombreAlumno),
      CURP: txt(iedu.CURP),
      nivelEducativo: txt(iedu.nivelEducativo),
      autRVOE: txt(iedu.autRVOE),
      rfcPago: txt(iedu.rfcPago),
    };
  }
  return out;
}

/**
 * Lee el JSON de una prefactura y arma el borrador del asistente.
 * `duplicar`: nueva carta porte (IdCCP nuevo, sin fechas de salida/llegada).
 */
export function borradorDesdeCfdi(cfdi: Nodo, { rfcEmisor, duplicar = false }: { rfcEmisor: string; duplicar?: boolean }): LecturaPrefactura {
  const tipo = txt(cfdi.TipoDeComprobante) as TipoComprobante;
  if (tipo === "P") return { ok: false, motivo: "Los complementos de pago guardados como prefactura todavía se abren solo en el escritorio." };
  if (tipo !== "I" && tipo !== "E" && tipo !== "T") return { ok: false, motivo: `La web no maneja comprobantes de tipo ${tipo || "desconocido"}.` };

  const avisos = new Set<string>();
  const conceptosJson = lista(obj(cfdi.Conceptos).Concepto);
  const nodoCp = obj(obj(cfdi.Complemento).CartaPorte);
  const conCartaPorte = Object.keys(nodoCp).length > 0;
  if (tipo === "T" && !conCartaPorte) return { ok: false, motivo: "Es un traslado sin carta porte: la web solo arma traslados con carta porte." };

  const receptor = obj(cfdi.Receptor);
  const global = obj(cfdi.InformacionGlobal);
  const relacionados = lista(cfdi.CfdiRelacionados);
  const uuids = relacionados.flatMap((r) => lista(r.CfdiRelacionado).map((x) => txt(x.UUID))).filter(Boolean);
  if (relacionados.length > 1) avisos.add("Trae varios grupos de CFDI relacionados: la web maneja uno y se abrió con el primer tipo de relación.");

  const base = borradorPara(tipo, { rfcEmisor }, conCartaPorte);
  const moneda = txt(cfdi.Moneda) || base.moneda;

  let cartaPorte: CartaPorteBorrador | null = null;
  if (conCartaPorte) {
    cartaPorte = cartaPorteDesdeJson(nodoCp, tipo === "T" ? conceptosJson : [], avisos);
    // El papel no viaja en el CFDI: un traslado es del dueño (o intermediario), una factura, del transportista.
    cartaPorte = { ...cartaPorte, papel: tipo === "T" ? "duenio" : "transportista" };
    if (duplicar) {
      cartaPorte = {
        ...cartaPorte,
        idCCP: generarIdCCP(),
        ubicaciones: cartaPorte.ubicaciones.map((u) => ({ ...u, fechaHora: "" })),
      };
    }
  }

  const borrador: FacturaBorrador = {
    ...base,
    serie: txt(cfdi.Serie),
    folio: duplicar ? "" : txt(cfdi.Folio),
    // La fecha de una prefactura ya pasó: se timbra con la de hoy.
    fechaActual: true,
    fechaEmision: "",
    moneda,
    tipoCambio: moneda !== "MXN" && moneda !== "XXX" ? txt(cfdi.TipoCambio) : "",
    exportacion: txt(cfdi.Exportacion) || base.exportacion,
    ...(tipo === "T"
      ? {}
      : {
          formaPago: txt(cfdi.FormaPago) || base.formaPago,
          metodoPago: txt(cfdi.MetodoPago) || base.metodoPago,
          condicionesDePago: txt(cfdi.CondicionesDePago),
          receptorRfc: txt(receptor.Rfc) || base.receptorRfc,
          usoCfdi: txt(receptor.UsoCFDI) || base.usoCfdi,
          conceptos: conceptosJson.length ? conceptosJson.map((c, i) => conceptoDe(c, i, avisos)) : base.conceptos,
          complementos: complementosDe(cfdi, conceptosJson, avisos),
        }),
    global: Object.keys(global).length
      ? { periodicidad: txt(global.Periodicidad), meses: txt(global.Meses), anio: txt(global["Año"] ?? global.Anio) }
      : base.global,
    relacionar: uuids.length > 0,
    relacion: uuids.length ? { tipoRelacion: txt(relacionados[0].TipoRelacion), uuids } : base.relacion,
    cartaPorte,
  };
  // Con cambios en los impuestos se dice cuánto era, para comparar.
  const lista_ = [...avisos].map((a) =>
    a.startsWith("Algún impuesto") && txt(cfdi.Total) ? `${a} El total guardado era ${num(cfdi.Total).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.` : a
  );
  return { ok: true, borrador, avisos: lista_ };
}
