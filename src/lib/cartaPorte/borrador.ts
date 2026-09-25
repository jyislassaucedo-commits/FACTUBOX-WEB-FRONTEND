/*
   Borrador de la carta porte dentro del asistente de Nueva factura.

   Guarda COPIAS de lo que se eligió de los catálogos (transporte, figuras,
   ubicaciones, mercancías), no sus id: la carta porte tiene que poder abrirse
   igual en el escritorio, que no tiene esos catálogos en la nube, y cambiar
   un catálogo después no debe alterar un viaje ya capturado.

   Sin "use client" ni dependencias de servidor: lo usan los pasos, la
   validación y el armado del JSON.
*/

import type { FiguraCP, MedioCP, MercanciaCP, TransporteCP, UbicacionCP } from "@/lib/cartaPorteShared";

export type TipoUbicacion = "Origen" | "Destino";

/** Una parada del viaje: la ubicación del catálogo más lo de este viaje. */
export type UbicacionViaje = UbicacionCP & {
  /** Clave local de la parada en el borrador (no va al SAT). */
  clave: string;
  tipoUbicacion: TipoUbicacion;
  /** "YYYY-MM-DDTHH:mm" (datetime-local); el SAT pide segundos. */
  fechaHora: string;
  /** Km desde la parada anterior; solo destinos. */
  distancia: string;
};

export type CantidadTransporta = {
  cantidad: string;
  /** clave local de la parada de origen / destino */
  origen: string;
  destino: string;
};

export type DocumentoAduanero = {
  tipoDocumento: string;
  numPedimento: string;
  idenDocAduanero: string;
  rfcImpo: string;
};

export type GuiaIdentificacion = { numero: string; descripcion: string; peso: string };

/** DetalleMercancia (lo pide el transporte marítimo). */
export type DetalleMercancia = {
  unidadPesoMerc: string;
  pesoBruto: string;
  pesoNeto: string;
  pesoTara: string;
  numPiezas: string;
};

/** Una mercancía del viaje: la del catálogo más cantidades y reparto. */
export type MercanciaViaje = MercanciaCP & {
  /** Clave local de la fila en el borrador (no va al SAT). */
  clave: string;
  /** Identificador de la importación de Excel, si vino de ahí. */
  identificador?: string;
  cantidad: string;
  /** PesoEnKg de la fila: peso por unidad × cantidad, editable. */
  pesoTotal: string;
  uuidComercioExt: string;
  claveSTCC: string;
  cantidadTransporta: CantidadTransporta[];
  documentos: DocumentoAduanero[];
  guias: GuiaIdentificacion[];
  detalle: DetalleMercancia | null;
};

/**
 * El papel de quien hace la carta porte en el viaje (frmInicioCartaPorte del
 * escritorio). Decide qué se timbra: el dueño y el intermediario, un traslado;
 * el transportista, una factura de ingreso por el flete; "en blanco", lo que
 * elija el usuario. No va al SAT: se deduce del tipo al abrir una prefactura.
 */
export type PapelCP = "duenio" | "transportista" | "intermediario" | "blanco";

export type CartaPorteBorrador = {
  version: "3.1";
  papel: PapelCP;
  /** Solo del intermediario: mueve la mercancía con su propio transporte. */
  transportePropio: boolean;
  idCCP: string;
  transpInternac: "Sí" | "No";
  entradaSalidaMerc: "" | "Entrada" | "Salida";
  paisOrigenDestino: string;
  regimenesAduaneros: string[];
  registroISTMO: boolean;
  ubicacionPoloOrigen: string;
  ubicacionPoloDestino: string;
  logisticaInversa: boolean;
  unidadPeso: string;
  medio: MedioCP;
  transporte: TransporteCP | null;
  figuras: FiguraCP[];
  ubicaciones: UbicacionViaje[];
  mercancias: MercanciaViaje[];
  /** Solo marítimo/aéreo/ferroviario (desktop: frmPopDetallesTransporte). */
  lugarContrato?: string;
  tipoCarga?: string;
};

/** Clave local aleatoria para filas del borrador. */
export function claveLocal(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * IdCCP como lo arma el escritorio: un GUID en mayúsculas con sus primeras
 * tres posiciones cambiadas por "CCC" (JsonGenerator.vb).
 */
export function generarIdCCP(): string {
  const guid = claveLocal().toUpperCase();
  return /^[0-9A-F]{8}-/.test(guid) ? `CCC${guid.slice(3)}` : `CCC${guid.replace(/-/g, "").slice(0, 5)}-0000-4000-8000-000000000000`;
}

/**
 * Si el comprobante lleva el complemento. El intermediario sin vehículos propios
 * solo factura su servicio (Ingreso SIN carta porte, clave 78141501): la carta
 * porte se la emite el transportista que contrató (Instructivo CCP 3.1,
 * Apéndice 1 nota 9 y Apéndice 5; Preguntas frecuentes 39).
 */
export function llevaComplementoCP(cp: CartaPorteBorrador | null): cp is CartaPorteBorrador {
  return cp !== null && !(cp.papel === "intermediario" && !cp.transportePropio);
}

export function cartaPorteNueva(): CartaPorteBorrador {
  return {
    version: "3.1",
    papel: "duenio",
    transportePropio: true,
    idCCP: generarIdCCP(),
    transpInternac: "No",
    entradaSalidaMerc: "",
    paisOrigenDestino: "",
    regimenesAduaneros: [],
    registroISTMO: false,
    ubicacionPoloOrigen: "",
    ubicacionPoloDestino: "",
    logisticaInversa: false,
    unidadPeso: "KGM",
    medio: "01",
    transporte: null,
    figuras: [],
    ubicaciones: [],
    mercancias: [],
  };
}

export function paradaDesde(u: UbicacionCP, tipoUbicacion: TipoUbicacion): UbicacionViaje {
  return { ...u, clave: claveLocal(), tipoUbicacion, fechaHora: "", distancia: "" };
}

export function mercanciaDesde(m: MercanciaCP, cantidad = "1"): MercanciaViaje {
  const c = Number(cantidad) || 0;
  const peso = Number(m.pesokg) || 0;
  return {
    ...m,
    clave: claveLocal(),
    cantidad,
    pesoTotal: peso > 0 && c > 0 ? redondear(peso * c, 3) : "",
    uuidComercioExt: "",
    claveSTCC: "",
    cantidadTransporta: [],
    documentos: [],
    guias: [],
    detalle: null,
  };
}

export function redondear(n: number, decimales: number): string {
  const f = 10 ** decimales;
  return String(Math.round((n + Number.EPSILON) * f) / f);
}

/**
 * IDUbicacion de cada parada, como el escritorio: "OR" o "DE" y 6 dígitos.
 * Se numeran en el orden del viaje, así cada una es única.
 */
export function idsUbicacion(ubicaciones: UbicacionViaje[]): Map<string, string> {
  const ids = new Map<string, string>();
  ubicaciones.forEach((u, i) => {
    ids.set(u.clave, `${u.tipoUbicacion === "Origen" ? "OR" : "DE"}${String(i + 1).padStart(6, "0")}`);
  });
  return ids;
}

/** Totales que el SAT pide y que se calculan solos. */
export function totalesCartaPorte(cp: CartaPorteBorrador) {
  const distancia = cp.ubicaciones
    .filter((u) => u.tipoUbicacion === "Destino")
    .reduce((acc, u) => acc + (Number(u.distancia) || 0), 0);
  const pesoBruto = cp.mercancias.reduce((acc, m) => acc + (Number(m.pesoTotal) || 0), 0);
  return {
    distancia,
    pesoBruto,
    /** Número de filas de mercancía, no la suma de cantidades (así lo cuenta el SAT). */
    numMercancias: cp.mercancias.length,
  };
}
