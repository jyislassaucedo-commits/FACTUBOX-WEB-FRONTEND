/*
   Borrador de carta porte -> JSON del CFDI (nodo Complemento.CartaPorte y,
   en un traslado, los conceptos).

   La forma es la que manda Factubox Escritorio Carta Porte
   (Helpers\Classes\JsonGenerator.vb, generarCartaPorte), para que una
   prefactura de la web se abra igual allá: mismas llaves, mismo anidado, mismo
   orden (el backend escribe los nodos del XML en el orden de las llaves y el
   XSD del SAT exige el orden de los hijos). Diferencias deliberadas, porque en
   el escritorio son errores:
     - No se mandan atributos vacíos ni null (allá salen "" y NombreFigura null).
     - El municipio del domicilio de una figura va cuando SÍ tiene valor.
     - Sin guías de identificación no se manda GuiasIdentificacion: [].
     - IDUbicacion se numera por la posición de la parada (allá, por el id que
       tecleó el usuario o el del catálogo); el SAT solo pide OR/DE + 6 dígitos
       y que no se repitan.
*/

import { idsUbicacion, totalesCartaPorte, type CartaPorteBorrador, type MercanciaViaje, type UbicacionViaje } from "./borrador";
import type { Domicilio, FiguraCP } from "@/lib/cartaPorteShared";

type Nodo = Record<string, unknown>;

/** Quita llaves con "", null, undefined, objetos vacíos y listas vacías. */
export function limpiar<T>(v: T): T {
  if (Array.isArray(v)) {
    return v.map(limpiar).filter((x) => !esVacio(x)) as unknown as T;
  }
  if (v && typeof v === "object") {
    const out: Nodo = {};
    for (const [k, x] of Object.entries(v as Nodo)) {
      const l = limpiar(x);
      if (!esVacio(l)) out[k] = l;
    }
    return out as T;
  }
  return v;
}

function esVacio(x: unknown) {
  if (x === null || x === undefined) return true;
  if (typeof x === "string") return x.trim() === "";
  if (Array.isArray(x)) return x.length === 0;
  if (typeof x === "object") return Object.keys(x as object).length === 0;
  return false;
}

function fijo(n: number, d: number) {
  return (Math.round((n + Number.EPSILON) * 10 ** d) / 10 ** d).toFixed(d);
}

function num(s: string | undefined) {
  return Number(String(s ?? "").replace(/,/g, "")) || 0;
}

/** "YYYY-MM-DDTHH:mm" (datetime-local) -> "YYYY-MM-DDTHH:mm:ss" */
function conSegundos(f: string) {
  return f.length === 16 ? `${f}:00` : f;
}

const EXTRANJERO = "XEXX010101000";

function domicilioJson(d: Domicilio): Nodo {
  return {
    Calle: d.calle,
    NumeroExterior: d.numeroexterior,
    NumeroInterior: d.numerointerior,
    Colonia: d.colonia,
    Localidad: d.localidad,
    Referencia: d.referencia,
    Municipio: d.municipio,
    Estado: d.estado,
    Pais: d.pais || "MEX",
    CodigoPostal: d.codigopostal,
  };
}

function ubicacionJson(u: UbicacionViaje, id: string, medio: string): Nodo {
  const extranjero = !!u.residenciafiscal && u.residenciafiscal !== "MEX";
  const conEstacion = medio !== "01" && !!u.numestacion;
  const conDistancia = u.tipoUbicacion === "Destino" && (medio === "01" || medio === "04");
  // Estaciones sin domicilio: el escritorio no lo manda en ferroviario ni
  // cuando el tipo de estación es intermedia (02).
  const conDomicilio = medio !== "04" && u.tipoestacion !== "02";
  return {
    TipoUbicacion: u.tipoUbicacion,
    IDUbicacion: id,
    RFCRemitenteDestinatario: extranjero ? EXTRANJERO : u.rfcremdest.toUpperCase(),
    NombreRemitenteDestinatario: u.nombreremdest,
    NumRegIdTrib: extranjero ? u.numregidtrib : "",
    ResidenciaFiscal: extranjero ? u.residenciafiscal : "",
    NumEstacion: conEstacion ? u.numestacion : "",
    NombreEstacion: conEstacion ? u.nombreestacion : "",
    NavegacionTrafico: medio === "02" ? u.navegaciontrafico || "Altura" : "",
    FechaHoraSalidaLlegada: conSegundos(u.fechaHora),
    TipoEstacion: conEstacion ? u.tipoestacion : "",
    DistanciaRecorrida: conDistancia ? fijo(num(u.distancia), 2) : "",
    Domicilio: conDomicilio ? domicilioJson(u) : null,
  };
}

/** Campos COFEPRIS que van según el sector (como el escritorio). */
const COFEPRIS_POR_SECTOR: Record<string, string[]> = {
  "01": ["DenominacionGenericaProd", "DenominacionDistintivaProd", "Fabricante", "FechaCaducidad", "LoteMedicamento", "FormaFarmaceutica", "CondicionesEspTransp", "RegistroSanitarioFolioAutorizacion"],
  "02": ["NombreIngredienteActivo", "NomQuimico", "Fabricante", "FechaCaducidad", "LoteMedicamento", "FormaFarmaceutica", "CondicionesEspTransp"],
  "03": ["DenominacionGenericaProd", "DenominacionDistintivaProd", "Fabricante", "FechaCaducidad", "LoteMedicamento", "FormaFarmaceutica", "CondicionesEspTransp"],
  "04": ["NomQuimico", "NumCAS"],
  "05": ["NombreIngredienteActivo", "NumRegSanPlagCOFEPRIS", "DatosFabricante", "DatosFormulador", "UsoAutorizado"],
};

function mercanciaJson(m: MercanciaViaje, cp: CartaPorteBorrador, ids: Map<string, string>): Nodo {
  const internacional = cp.transpInternac === "Sí";
  const sector = m.sectorcofepris && m.sectorcofepris !== "0" ? m.sectorcofepris : "";
  const cofepris = Object.fromEntries(
    (COFEPRIS_POR_SECTOR[sector] ?? []).map((c) => [c, (m as unknown as Record<string, string>)[c] ?? ""])
  );
  const valorUnitario = num(m.valor);
  const cantidad = num(m.cantidad);
  const peligrosa = m.materialpeligroso === "Sí";
  const entrada = cp.entradaSalidaMerc === "Entrada";
  return {
    BienesTransp: m.claveprodcp,
    ClaveSTCC: cp.medio === "04" ? m.claveSTCC : "",
    Descripcion: m.descripcion,
    Cantidad: m.cantidad.trim(),
    ClaveUnidad: m.claveuni,
    Unidad: m.unidad.slice(0, 20),
    Dimensiones: m.dimensiones,
    MaterialPeligroso: m.materialpeligroso === "Sí" || m.materialpeligroso === "No" ? m.materialpeligroso : "",
    CveMaterialPeligroso: peligrosa ? m.clavepeligroso : "",
    Embalaje: peligrosa ? m.embalaje : "",
    DescripEmbalaje: peligrosa ? m.descembalaje : "",
    SectorCOFEPRIS: sector,
    ...cofepris,
    PermisoImportacion: internacional && entrada && ["01", "02", "03"].includes(sector) ? m.PermisoImportacion : "",
    FolioImpoVUCEM: internacional && entrada && ["01", "02", "04", "05"].includes(sector) ? m.FolioImpoVUCEM : "",
    RazonSocialEmpImp: internacional && entrada && sector === "04" ? m.RazonSocialEmpImp.toUpperCase() : "",
    PesoEnKg: fijo(num(m.pesoTotal), 3),
    ValorMercancia: valorUnitario !== 0 || cp.medio === "03" ? fijo(valorUnitario * cantidad, 3) : "",
    Moneda: valorUnitario !== 0 || cp.medio === "03" ? m.moneda || "MXN" : "",
    FraccionArancelaria: internacional ? m.FraccionArrancelaria : "",
    UUIDComercioExt: internacional ? m.uuidComercioExt.toUpperCase() : "",
    TipoMateria: internacional ? m.TipoMateria : "",
    DescripcionMateria: internacional && m.TipoMateria === "05" ? m.DescripcionMateria : "",
    DocumentacionAduanera: internacional
      ? m.documentos.map((d) =>
          d.tipoDocumento === "01"
            ? { TipoDocumento: "01", NumPedimento: d.numPedimento, RFCImpo: d.rfcImpo }
            : { TipoDocumento: d.tipoDocumento, IdentDocAduanero: d.idenDocAduanero }
        )
      : [],
    GuiasIdentificacion: m.guias.map((g) => ({
      NumeroGuiaIdentificacion: g.numero,
      DescripGuiaIdentificacion: g.descripcion,
      PesoGuiaIdentificacion: g.peso,
    })),
    CantidadTransporta: m.cantidadTransporta
      .filter((c) => ids.has(c.origen) && ids.has(c.destino))
      .map((c) => ({ Cantidad: c.cantidad.trim(), IDOrigen: ids.get(c.origen), IDDestino: ids.get(c.destino) })),
    DetalleMercancia:
      cp.medio === "02" && m.detalle
        ? {
            UnidadPesoMerc: m.detalle.unidadPesoMerc || cp.unidadPeso,
            PesoBruto: m.detalle.pesoBruto,
            PesoNeto: m.detalle.pesoNeto,
            PesoTara: m.detalle.pesoTara,
            NumPiezas: m.detalle.numPiezas,
          }
        : null,
  };
}

function figuraJson(f: FiguraCP): Nodo {
  const extranjero = !!f.residenciafiscal && f.residenciafiscal !== "MEX";
  return {
    TipoFigura: f.tipofigura,
    RFCFigura: extranjero ? "" : f.rfc.toUpperCase(),
    NumLicencia: f.tipofigura === "01" ? f.numlicencia : "",
    NombreFigura: f.nombre.toUpperCase(),
    NumRegIdTribFigura: extranjero ? f.numregidtrib : "",
    ResidenciaFiscalFigura: extranjero ? f.residenciafiscal : "",
    PartesTransporte: f.tipofigura === "02" || f.tipofigura === "03" ? f.partes.map((p) => ({ ParteTransporte: p.partetransporte })) : [],
    Domicilio: f.domicilio === "SI" ? domicilioJson(f) : null,
  };
}

function transporteJson(cp: CartaPorteBorrador, pesoBruto: number, hayPeligrosa: boolean): Nodo {
  const t = cp.transporte;
  if (!t) return {};
  if (cp.medio === "01" && t.autotransporte) {
    const a = t.autotransporte;
    // Como el escritorio: peso bruto de la unidad (t) más la carga en toneladas.
    const pbv = (num(a.Pesobrutovehicular) || 0.1) + pesoBruto / 1000;
    return {
      Autotransporte: {
        PermSCT: t.permsct,
        NumPermisoSCT: t.numpermisosct,
        IdentificacionVehicular: {
          ConfigVehicular: a.configvehicular,
          PesoBrutoVehicular: fijo(pbv, 2),
          PlacaVM: a.placavm.toUpperCase(),
          AnioModeloVM: a.aniomodelovm,
        },
        Seguros: {
          AseguraRespCivil: a.asegurarespcivil,
          PolizaRespCivil: a.polizarespcivil,
          AseguraMedAmbiente: hayPeligrosa ? a.aseguramedambiente : "",
          PolizaMedAmbiente: hayPeligrosa ? a.polizamedambiente : "",
          AseguraCarga: a.aseguracarga,
          PolizaCarga: a.polizacarga,
          PrimaSeguro: a.primaseguro,
        },
        Remolques: { Remolque: a.remolques.map((r) => ({ SubTipoRem: r.subtiporem, Placa: r.placa.toUpperCase() })) },
      },
    };
  }
  if (cp.medio === "02" && t.maritimo) {
    const m = t.maritimo;
    return {
      TransporteMaritimo: {
        PermSCT: t.permsct,
        NumPermisoSCT: t.numpermisosct,
        NombreAseg: t.nombreaseg,
        NumPolizaSeguro: t.numpolizaseguro,
        TipoEmbarcacion: m.tipoembarcacion,
        Matricula: m.matricula,
        NumeroOMI: m.numeroomi,
        NombreEmbarc: m.nombreembarc,
        NacionalidadEmbarc: m.nacionalidadembarc,
        UnidadesDeArqBruto: m.unidadesdearqbruto,
        TipoCarga: cp.tipoCarga ?? "",
        Eslora: num(m.eslora) ? m.eslora : "",
        Manga: num(m.manga) ? m.manga : "",
        Calado: num(m.calado) ? m.calado : "",
        Puntal: num(m.Puntal) ? m.Puntal : "",
        LineaNaviera: m.lineanaviera,
        NombreAgenteNaviero: m.nombreagentenaviero,
        NumAutorizacionNaviero: m.numautorizacionnaviero,
        NumConocEmbarc: m.numconocembarc,
        PermisoTempNavegacion: m.nacionalidadembarc !== "MEX" ? m.Permisotempnavegacion : "",
        Contenedor: m.contenedores.map((c) =>
          c.tipocontenedor === "CM011"
            ? {
                TipoContenedor: c.tipocontenedor,
                IdCCPRelacionado: c.IdCCPRelacionado,
                PlacaVMCCP: c.PlacaVMCCP,
                FechaCertificacionCCP: c.FechaCertificacionCCP ? conSegundos(`${c.FechaCertificacionCCP.slice(0, 10)}T00:00`) : "",
                RemolquesCCP: { RemolqueCCP: c.remolques.map((r) => ({ SubTipoRemCCP: r.SubTipoRemCCP, PlacaCCP: r.PlacaCCP })) },
              }
            : { TipoContenedor: c.tipocontenedor, MatriculaContenedor: c.matriculacontenedor, NumPrecinto: c.numprecinto }
        ),
      },
    };
  }
  if (cp.medio === "03" && t.aereo) {
    const a = t.aereo;
    const conRfc = !!a.rfcembarcador.trim();
    return {
      TransporteAereo: {
        PermSCT: t.permsct,
        NumPermisoSCT: t.numpermisosct,
        MatriculaAeronave: a.matriculaaeronave,
        NombreAseg: t.nombreaseg,
        NumPolizaSeguro: t.numpolizaseguro,
        NumeroGuia: a.numeroguia,
        LugarContrato: cp.lugarContrato ?? "",
        CodigoTransportista: a.codigotransportista,
        RFCEmbarcador: conRfc ? a.rfcembarcador.toUpperCase() : "",
        NumRegIdTribEmbarc: conRfc ? "" : a.numregidtribembarc,
        ResidenciaFiscalEmbarc: conRfc ? "" : a.residenciafiscalembarc,
        NombreEmbarcador: a.nombreembarcador,
      },
    };
  }
  if (cp.medio === "04" && t.ferroviario) {
    const f = t.ferroviario;
    return {
      TransporteFerroviario: {
        TipoDeServicio: f.tipodeservicio,
        TipoDeTrafico: f.tipodetrafico,
        NombreAseg: t.nombreaseg,
        NumPolizaSeguro: t.numpolizaseguro,
        DerechosDePaso: f.derechosPaso.map((d) => ({ TipoDerechoDePaso: d.tipoderechodepaso, KilometrajePagado: d.kilometrajepagado })),
        Carro: f.carros.map((c) => ({
          TipoCarro: c.tipocarro,
          MatriculaCarro: c.matriculacarro,
          GuiaCarro: c.guiacarro,
          ToneladasCarro: fijo(pesoBruto / 1000 / Math.max(1, f.carros.length), 3),
          Contenedor: c.contenedores.map((k) => ({
            TipoContenedor: k.tipocontenedor,
            PesoContenedorVacio: k.pesocontenedorvacio,
            PesoNetoMercancia: fijo(pesoBruto / 1000 / Math.max(1, f.carros.length) / Math.max(1, c.contenedores.length), 3),
          })),
        })),
      },
    };
  }
  return {};
}

/** El nodo Complemento.CartaPorte completo, sin llaves vacías. */
export function nodoCartaPorte(cp: CartaPorteBorrador): Nodo {
  const ids = idsUbicacion(cp.ubicaciones);
  const tot = totalesCartaPorte(cp);
  const internacional = cp.transpInternac === "Sí";
  const hayPeligrosa = cp.mercancias.some((m) => m.materialpeligroso === "Sí");
  const pesoNeto = cp.medio === "02" ? cp.mercancias.reduce((a, m) => a + num(m.detalle?.pesoNeto), 0) : 0;
  const pesoBrutoMaritimo = cp.medio === "02" ? cp.mercancias.reduce((a, m) => a + num(m.detalle?.pesoBruto), 0) : 0;
  const pesoBruto = cp.medio === "02" && pesoBrutoMaritimo > 0 ? pesoBrutoMaritimo : tot.pesoBruto;

  return limpiar({
    Version: "3.1",
    IdCCP: cp.idCCP,
    TranspInternac: cp.transpInternac,
    EntradaSalidaMerc: internacional ? cp.entradaSalidaMerc : "",
    PaisOrigenDestino: internacional ? cp.paisOrigenDestino : "",
    ViaEntradaSalida: internacional ? cp.medio : "",
    TotalDistRec: cp.medio === "01" || cp.medio === "04" ? fijo(tot.distancia, 2) : "",
    RegistroISTMO: cp.registroISTMO ? "Sí" : "",
    UbicacionPoloOrigen: cp.registroISTMO ? cp.ubicacionPoloOrigen : "",
    UbicacionPoloDestino: cp.registroISTMO ? cp.ubicacionPoloDestino : "",
    RegimenesAduaneros: internacional
      ? { RegimenAduaneroCCP: cp.regimenesAduaneros.map((r) => ({ RegimenAduanero: r })) }
      : null,
    Ubicaciones: { Ubicacion: cp.ubicaciones.map((u) => ubicacionJson(u, ids.get(u.clave)!, cp.medio)) },
    Mercancias: {
      PesoBrutoTotal: fijo(pesoBruto, 3),
      UnidadPeso: cp.unidadPeso,
      PesoNetoTotal: pesoNeto > 0 ? fijo(pesoNeto, 3) : "",
      NumTotalMercancias: tot.numMercancias,
      LogisticaInversaRecoleccionDevolucion: cp.logisticaInversa && cp.medio === "01" ? "Sí" : "",
      Mercancia: cp.mercancias.map((m) => mercanciaJson(m, cp, ids)),
      ...transporteJson(cp, pesoBruto, hayPeligrosa),
    },
    FiguraTransporte: { TiposFigura: cp.figuras.map(figuraJson) },
  });
}

/**
 * Los conceptos de un traslado: uno por mercancía, en ceros (el traslado no
 * cobra), como el escritorio, con la clave de BienesTransp y "MERC-0001".
 */
export function conceptosTraslado(cp: CartaPorteBorrador): Nodo[] {
  return cp.mercancias.map((m, i) =>
    limpiar({
      // En un traslado el SAT exige la misma clave que BienesTransp.
      ClaveProdServ: m.claveprodcp,
      NoIdentificacion: `MERC-${String(m.id ?? i + 1).padStart(4, "0")}`,
      Cantidad: fijo(num(m.cantidad), 2),
      ClaveUnidad: m.claveuni,
      Unidad: m.unidad.slice(0, 20),
      Descripcion: m.descripcion,
      ValorUnitario: "0",
      Importe: "0",
      ObjetoImp: "01",
    })
  );
}
