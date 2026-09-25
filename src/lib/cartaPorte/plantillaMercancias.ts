import { mercanciaVacia, validarMercancia, type MercanciaCP } from "@/lib/cartaPorteShared";
import { mercanciaDesde, redondear, type MercanciaViaje } from "./borrador";

/*
   Lectura de PLANTILLA-MERCANCIAS.xlsx, la misma plantilla del escritorio
   (frmPopImportarMercanciaMulti): seis hojas con el título en la fila 1, los
   encabezados en la fila 2 y los datos desde la fila 3, unidas por el
   Identificador de la mercancía.

   Las columnas se buscan por lo que dice el encabezado, no por su letra: el
   escritorio lee "Clave de Bienes Transporta CP" (columna B) como la clave de
   producto y "Clave Producto / Servicio" (C) como la de carta porte; aquí cada
   una va a donde dice su nombre (B = BienesTransp, C = ClaveProdServ).

   Todo esto es puro (sin red): revisa el formato. Que las claves existan en los
   catálogos del SAT lo revisa importarMercancias.ts contra el servidor.
*/

export type Celda = string | number | boolean | Date | null | undefined;
export type HojaExcel = { sheet: string; data: Celda[][] };

export type ErrorImportacion = {
  hoja: string;
  /** Fila de Excel (la que ve el usuario), no el índice. */
  fila: number;
  identificador: string;
  columna: string;
  mensaje: string;
};

/** Un reparto de la hoja Cantidad Transportista, todavía con los IDs del archivo. */
export type RepartoCrudo = { fila: number; cantidad: string; idOrigen: string; idDestino: string };

export type MercanciaImportada = {
  fila: number;
  identificador: string;
  mercancia: MercanciaViaje;
  repartos: RepartoCrudo[];
};

export type LecturaPlantilla = {
  mercancias: MercanciaImportada[];
  errores: ErrorImportacion[];
  /** Filas con datos por hoja, para el resumen ("4,850 filas en Mercancia"). */
  filasPorHoja: Record<string, number>;
};

/* -------------------------------------------------------------------------- */
/* Hojas y columnas                                                           */
/* -------------------------------------------------------------------------- */

type Columna = { titulo: string; alias?: string[] };
type Hoja<K extends string> = { nombre: string; columnas: Record<K, Columna> };

const MERCANCIA: Hoja<
  | "identificador" | "claveprodcp" | "claveprod" | "descripcion" | "claveuni" | "unidad" | "cantidad" | "valor"
  | "pesokg" | "moneda" | "dimensiones" | "uuidComercioExt" | "claveSTCC" | "PermisoImportacion" | "FolioImpoVUCEM"
  | "RazonSocialEmpImp" | "TipoMateria" | "DescripcionMateria" | "FraccionArrancelaria" | "materialpeligroso"
  | "clavepeligroso" | "embalaje" | "descembalaje"
> = {
  nombre: "Mercancia",
  columnas: {
    identificador: { titulo: "Identificador" },
    claveprodcp: { titulo: "Clave de Bienes Transporta CP", alias: ["BienesTransp", "Clave Bienes Transportados"] },
    claveprod: { titulo: "Clave Producto / Servicio", alias: ["ClaveProdServ"] },
    descripcion: { titulo: "Descripcion" },
    claveuni: { titulo: "Clave Unidad", alias: ["ClaveUnidad"] },
    unidad: { titulo: "Unidad" },
    cantidad: { titulo: "Cantidad" },
    valor: { titulo: "Valor Mercancia", alias: ["ValorMercancia"] },
    pesokg: { titulo: "Peso En Kg", alias: ["PesoEnKg"] },
    moneda: { titulo: "Moneda" },
    dimensiones: { titulo: "Dimensiones" },
    uuidComercioExt: { titulo: "Folio Fiscal Comercio Exterior", alias: ["UUIDComercioExt"] },
    claveSTCC: { titulo: "Clave STCC", alias: ["ClaveSTCC"] },
    PermisoImportacion: { titulo: "Permiso Importacion" },
    FolioImpoVUCEM: { titulo: "Folio de Importacion VUCEM" },
    RazonSocialEmpImp: { titulo: "Razon Social Empresa Importadora" },
    TipoMateria: { titulo: "Tipo Materia" },
    DescripcionMateria: { titulo: "Descripcion Materia" },
    FraccionArrancelaria: { titulo: "Fraccion Arancelaria" },
    materialpeligroso: { titulo: "Material Peligroso" },
    clavepeligroso: { titulo: "Clave Material Peligroso", alias: ["CveMaterialPeligroso"] },
    embalaje: { titulo: "Tipo Embalaje", alias: ["Embalaje"] },
    descembalaje: { titulo: "Descripcion Embalaje", alias: ["DescripEmbalaje"] },
  },
};

const CANTIDAD_TRANSPORTA: Hoja<"identificador" | "cantidad" | "idOrigen" | "idDestino"> = {
  nombre: "Cantidad Transportista",
  columnas: {
    identificador: { titulo: "Identificador Mercancia" },
    cantidad: { titulo: "Cantidad" },
    idOrigen: { titulo: "ID Origen", alias: ["IDOrigen"] },
    idDestino: { titulo: "ID Destino", alias: ["IDDestino"] },
  },
};

const COFEPRIS: Hoja<
  | "identificador" | "sectorcofepris" | "DenominacionGenericaProd" | "DenominacionDistintivaProd" | "Fabricante"
  | "FechaCaducidad" | "LoteMedicamento" | "FormaFarmaceutica" | "CondicionesEspTransp"
  | "RegistroSanitarioFolioAutorizacion" | "NombreIngredienteActivo" | "NomQuimico" | "NumCAS"
  | "NumRegSanPlagCOFEPRIS" | "DatosFabricante" | "DatosFormulador" | "DatosMaquilador" | "UsoAutorizado"
> = {
  nombre: "Sector COFEPRIS",
  columnas: {
    identificador: { titulo: "Identificador Mercancia" },
    sectorcofepris: { titulo: "Sector COFEPRIS" },
    DenominacionGenericaProd: { titulo: "Denominacion Generica" },
    DenominacionDistintivaProd: { titulo: "Denominacion Distintiva" },
    Fabricante: { titulo: "Fabricante" },
    FechaCaducidad: { titulo: "Fecha Caducidad" },
    LoteMedicamento: { titulo: "Lote Medicamento" },
    FormaFarmaceutica: { titulo: "Forma Farmaceutica" },
    CondicionesEspTransp: { titulo: "Condiciones Especiales de Transporte" },
    RegistroSanitarioFolioAutorizacion: { titulo: "Registro Sanitario / Folio de Autorizacion" },
    NombreIngredienteActivo: { titulo: "Nombre Ingrediente Activo" },
    NomQuimico: { titulo: "Nombre Quimico" },
    NumCAS: { titulo: "Num CAS" },
    NumRegSanPlagCOFEPRIS: { titulo: "Numero de Registro Sanitario" },
    DatosFabricante: { titulo: "Datos Fabricante" },
    DatosFormulador: { titulo: "Datos Formulador" },
    DatosMaquilador: { titulo: "Datos Maquilador" },
    UsoAutorizado: { titulo: "Uso Autorizado" },
  },
};

const DETALLE: Hoja<"identificador" | "unidadPesoMerc" | "pesoBruto" | "pesoNeto" | "numPiezas"> = {
  nombre: "Detalle Mercancia",
  columnas: {
    identificador: { titulo: "Identificador Mercancia" },
    unidadPesoMerc: { titulo: "Unidad Peso" },
    pesoBruto: { titulo: "Peso Bruto" },
    pesoNeto: { titulo: "Peso Neto" },
    numPiezas: { titulo: "Numero de Piezas" },
  },
};

const GUIAS: Hoja<"identificador" | "numero" | "descripcion" | "peso"> = {
  nombre: "Guias Identificacion",
  columnas: {
    identificador: { titulo: "Identificador Mercancia" },
    numero: { titulo: "Numero" },
    descripcion: { titulo: "Descripcion" },
    peso: { titulo: "Peso" },
  },
};

const DOCUMENTOS: Hoja<"identificador" | "tipoDocumento" | "numPedimento" | "idenDocAduanero" | "rfcImpo"> = {
  nombre: "Documentacion Aduanera",
  columnas: {
    identificador: { titulo: "Identificador Mercancia" },
    tipoDocumento: { titulo: "Tipo Documento" },
    numPedimento: { titulo: "Numero Pedimento" },
    idenDocAduanero: { titulo: "ID. Documentacion Aduanero" },
    rfcImpo: { titulo: "RFC Importador" },
  },
};

export const HOJAS_PLANTILLA = [MERCANCIA, CANTIDAD_TRANSPORTA, COFEPRIS, DETALLE, GUIAS, DOCUMENTOS].map((h) => h.nombre);

/** Por hoja, en el orden de la plantilla, y dentro de cada una por fila. */
export function ordenarErrores(errores: ErrorImportacion[]): ErrorImportacion[] {
  const pos = (h: string) => {
    const i = HOJAS_PLANTILLA.indexOf(h);
    return i < 0 ? HOJAS_PLANTILLA.length : i;
  };
  return [...errores].sort((a, b) => pos(a.hoja) - pos(b.hoja) || a.fila - b.fila);
}

/** Título visible de cada campo de la hoja Mercancia, para los errores. */
export function tituloColumna(campo: string): string {
  return (MERCANCIA.columnas as Record<string, Columna>)[campo]?.titulo ?? campo;
}

/* -------------------------------------------------------------------------- */
/* Lectura                                                                    */
/* -------------------------------------------------------------------------- */

/** "Clave Producto / Servicio" y "claveproductoservicio" son el mismo encabezado. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function aTexto(c: Celda): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) {
    if (Number.isNaN(c.getTime())) return "";
    return c.toISOString().slice(0, 10);
  }
  if (typeof c === "number") return Number.isFinite(c) ? String(c) : "";
  if (typeof c === "boolean") return c ? "Sí" : "No";
  return String(c).trim();
}

type FilaLeida<K extends string> = { fila: number; v: Record<K, string> };

/**
 * Las filas de una hoja como objetos por campo. El renglón de encabezados es
 * el primero (de los 5 de arriba) que trae un "Identificador": así aguanta que
 * alguien borre la fila del título.
 */
function leerHoja<K extends string>(hoja: HojaExcel | undefined, def: Hoja<K>): { filas: FilaLeida<K>[]; faltan: string[] } {
  if (!hoja) return { filas: [], faltan: [] };
  const inicio = hoja.data.slice(0, 5).findIndex((r) => r.some((c) => normalizar(aTexto(c)).startsWith("identificador")));
  if (inicio < 0) return { filas: [], faltan: [def.columnas["identificador" as K].titulo] };

  const encabezados = hoja.data[inicio].map((c) => normalizar(aTexto(c)));
  const indice = {} as Record<K, number>;
  const faltan: string[] = [];
  for (const campo of Object.keys(def.columnas) as K[]) {
    const col = def.columnas[campo];
    const buscados = [col.titulo, ...(col.alias ?? [])].map(normalizar);
    const i = encabezados.findIndex((h) => buscados.includes(h));
    indice[campo] = i;
    if (i < 0 && campo === ("identificador" as K)) faltan.push(col.titulo);
  }

  const filas: FilaLeida<K>[] = [];
  for (let r = inicio + 1; r < hoja.data.length; r++) {
    const renglon = hoja.data[r];
    if (!renglon || renglon.every((c) => aTexto(c) === "")) continue;
    const v = {} as Record<K, string>;
    for (const campo of Object.keys(indice) as K[]) {
      v[campo] = indice[campo] >= 0 ? aTexto(renglon[indice[campo]]) : "";
    }
    filas.push({ fila: r + 1, v });
  }
  return { filas, faltan };
}

function hojaPorNombre(hojas: HojaExcel[], nombre: string): HojaExcel | undefined {
  const n = normalizar(nombre);
  return hojas.find((h) => normalizar(h.sheet) === n);
}

const numero = (s: string) => (s.trim() === "" ? NaN : Number(s.replace(/,/g, "")));
/** Excel guarda "01" como el número 1: las claves de dos dígitos se rellenan. */
const dosDigitos = (s: string) => (/^\d$/.test(s) ? `0${s}` : s);
const RE_UUID =/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** "Si", "sí", "S", "1", "true" son "Sí"; "No", "N", "0" son "No"; vacío queda vacío. */
function siNo(s: string): string {
  const n = normalizar(s);
  if (n === "") return "";
  if (["si", "s", "1", "true", "yes"].includes(n)) return "Sí";
  if (["no", "n", "0", "false"].includes(n)) return "No";
  return s;
}

/**
 * Lee las hojas del archivo y arma las mercancías con todo lo que traen las
 * demás hojas. Lo que no cumple el formato queda en `errores` y esa mercancía
 * no se incluye.
 */
export function leerPlantillaMercancias(hojas: HojaExcel[]): LecturaPlantilla {
  const errores: ErrorImportacion[] = [];
  const error = (hoja: string, fila: number, identificador: string, columna: string, mensaje: string) =>
    errores.push({ hoja, fila, identificador, columna, mensaje });

  // Sin una hoja llamada "Mercancia" se toma la primera: hay quien renombra
  // la pestaña o exporta solo esa hoja.
  const hojaMerc = hojaPorNombre(hojas, MERCANCIA.nombre) ?? hojas[0];
  const merc = leerHoja(hojaMerc, MERCANCIA);
  const filasPorHoja: Record<string, number> = { [MERCANCIA.nombre]: merc.filas.length };
  for (const f of merc.faltan) error(MERCANCIA.nombre, 2, "", f, "No se encontró esta columna en los encabezados (fila 2)");

  const porId = new Map<string, MercanciaImportada>();
  const conError = new Set<string>();
  const filaDeId = new Map<string, number>();
  const orden: MercanciaImportada[] = [];

  for (const { fila, v } of merc.filas) {
    const id = v.identificador;
    const err = (campo: string, mensaje: string) => {
      error(MERCANCIA.nombre, fila, id, tituloColumna(campo), mensaje);
      conError.add(id || `#${fila}`);
    };
    if (!id) {
      err("identificador", "Está vacío; cada mercancía necesita su identificador");
      continue;
    }
    if (filaDeId.has(id)) {
      err("identificador", `Repetido en la fila ${filaDeId.get(id)!.toLocaleString("es-MX")}`);
      continue;
    }
    filaDeId.set(id, fila);

    const cat: MercanciaCP = {
      ...mercanciaVacia(),
      claveprodcp: v.claveprodcp,
      claveprod: v.claveprod || v.claveprodcp,
      descripcion: v.descripcion,
      claveuni: v.claveuni.toUpperCase(),
      unidad: v.unidad,
      dimensiones: v.dimensiones,
      materialpeligroso: siNo(v.materialpeligroso),
      clavepeligroso: v.clavepeligroso,
      embalaje: v.embalaje,
      descembalaje: v.descembalaje,
      pesokg: v.pesokg.replace(/,/g, ""),
      valor: v.valor.replace(/,/g, "") || "0",
      moneda: (v.moneda || "MXN").toUpperCase(),
      PermisoImportacion: v.PermisoImportacion,
      FolioImpoVUCEM: v.FolioImpoVUCEM,
      RazonSocialEmpImp: v.RazonSocialEmpImp,
      TipoMateria: dosDigitos(v.TipoMateria),
      DescripcionMateria: v.DescripcionMateria,
      FraccionArrancelaria: v.FraccionArrancelaria,
    };

    // Las reglas de siempre (las mismas del formulario de mercancías)…
    const e = validarMercancia(cat, cat.materialpeligroso !== "");
    for (const [campo, mensaje] of Object.entries(e)) {
      err(campo, campo === "pesokg" ? (v.pesokg ? `${v.pesokg} no es un peso mayor que cero` : "Está vacío; debe ser mayor que cero") : mensaje);
    }
    // …más lo que solo trae el archivo.
    const cantidad = numero(v.cantidad);
    if (!(cantidad > 0)) err("cantidad", v.cantidad ? `${v.cantidad} no es una cantidad mayor que cero` : "Está vacía; debe ser mayor que cero");
    if (cat.materialpeligroso && cat.materialpeligroso !== "Sí" && cat.materialpeligroso !== "No") {
      err("materialpeligroso", `"${v.materialpeligroso}" no se entiende; escribe Sí o No`);
    }
    if (v.uuidComercioExt && !RE_UUID.test(v.uuidComercioExt)) err("uuidComercioExt", "No es un folio fiscal (UUID) válido");
    if (conError.has(id)) continue;

    const mercancia: MercanciaViaje = {
      ...mercanciaDesde(cat, String(cantidad)),
      identificador: id,
      uuidComercioExt: v.uuidComercioExt,
      claveSTCC: v.claveSTCC,
    };
    const item: MercanciaImportada = { fila, identificador: id, mercancia, repartos: [] };
    porId.set(id, item);
    orden.push(item);
  }

  /** La mercancía a la que apunta una fila de otra hoja, o el error de por qué no. */
  function destino(hoja: string, fila: number, id: string): MercanciaImportada | null {
    if (!id) {
      error(hoja, fila, "", "Identificador Mercancia", "Está vacío");
      return null;
    }
    const m = porId.get(id);
    if (m) return m;
    // Si la mercancía ya trae errores no se repite el aviso en cada hoja.
    if (!conError.has(id)) error(hoja, fila, id, "Identificador Mercancia", "No hay una mercancía con este identificador en la hoja Mercancia");
    return null;
  }
  const descartar = (m: MercanciaImportada) => {
    conError.add(m.identificador);
    porId.delete(m.identificador);
  };

  /* Cantidad Transportista ------------------------------------------------ */
  const cant = leerHoja(hojaPorNombre(hojas, CANTIDAD_TRANSPORTA.nombre), CANTIDAD_TRANSPORTA);
  filasPorHoja[CANTIDAD_TRANSPORTA.nombre] = cant.filas.length;
  for (const { fila, v } of cant.filas) {
    const m = destino(CANTIDAD_TRANSPORTA.nombre, fila, v.identificador);
    if (!m) continue;
    if (!(numero(v.cantidad) > 0)) {
      error(CANTIDAD_TRANSPORTA.nombre, fila, m.identificador, "Cantidad", "Debe ser mayor que cero");
      descartar(m);
      continue;
    }
    m.repartos.push({ fila, cantidad: String(numero(v.cantidad)), idOrigen: v.idOrigen.toUpperCase(), idDestino: v.idDestino.toUpperCase() });
  }

  /* Sector COFEPRIS -------------------------------------------------------- */
  const cof = leerHoja(hojaPorNombre(hojas, COFEPRIS.nombre), COFEPRIS);
  filasPorHoja[COFEPRIS.nombre] = cof.filas.length;
  for (const { fila, v } of cof.filas) {
    const m = destino(COFEPRIS.nombre, fila, v.identificador);
    if (!m) continue;
    if (!v.sectorcofepris) {
      error(COFEPRIS.nombre, fila, m.identificador, "Sector COFEPRIS", "Está vacío");
      descartar(m);
      continue;
    }
    const { identificador: _id, ...datos } = v;
    void _id;
    Object.assign(m.mercancia, datos, {
      sectorcofepris: dosDigitos(v.sectorcofepris),
      FormaFarmaceutica: dosDigitos(v.FormaFarmaceutica),
      CondicionesEspTransp: dosDigitos(v.CondicionesEspTransp),
    });
  }

  /* Detalle Mercancia (marítimo) ------------------------------------------ */
  const det = leerHoja(hojaPorNombre(hojas, DETALLE.nombre), DETALLE);
  filasPorHoja[DETALLE.nombre] = det.filas.length;
  for (const { fila, v } of det.filas) {
    const m = destino(DETALLE.nombre, fila, v.identificador);
    if (!m) continue;
    const bruto = numero(v.pesoBruto);
    const neto = numero(v.pesoNeto);
    const piezas = numero(v.numPiezas);
    const falla = m.mercancia.detalle
      ? ["Identificador Mercancia", "Esta mercancía ya tiene su detalle en otra fila"]
      : !v.unidadPesoMerc
        ? ["Unidad Peso", "Está vacía"]
        : !(bruto > 0)
          ? ["Peso Bruto", "Debe ser mayor que cero"]
          : !(neto > 0) || neto > bruto
            ? ["Peso Neto", "Debe ser mayor que cero y no mayor que el peso bruto"]
            : !(Number.isInteger(piezas) && piezas > 0)
              ? ["Numero de Piezas", "Debe ser un número entero mayor que cero"]
              : null;
    if (falla) {
      error(DETALLE.nombre, fila, m.identificador, falla[0], falla[1]);
      descartar(m);
      continue;
    }
    m.mercancia.detalle = {
      unidadPesoMerc: v.unidadPesoMerc.toUpperCase(),
      pesoBruto: String(bruto),
      pesoNeto: String(neto),
      pesoTara: redondear(bruto - neto, 3),
      numPiezas: String(piezas),
    };
  }

  /* Guias Identificacion -------------------------------------------------- */
  const gui = leerHoja(hojaPorNombre(hojas, GUIAS.nombre), GUIAS);
  filasPorHoja[GUIAS.nombre] = gui.filas.length;
  for (const { fila, v } of gui.filas) {
    const m = destino(GUIAS.nombre, fila, v.identificador);
    if (!m) continue;
    const falla = !v.numero
      ? ["Numero", "Está vacío"]
      : v.numero.length < 10 || v.numero.length > 30
        ? ["Numero", "El SAT pide de 10 a 30 caracteres"]
      : !v.descripcion
        ? ["Descripcion", "Está vacía"]
        : !(numero(v.peso) > 0)
          ? ["Peso", "Debe ser mayor que cero"]
          : null;
    if (falla) {
      error(GUIAS.nombre, fila, m.identificador, falla[0], falla[1]);
      descartar(m);
      continue;
    }
    m.mercancia.guias.push({ numero: v.numero, descripcion: v.descripcion, peso: String(numero(v.peso)) });
  }

  /* Documentacion Aduanera ------------------------------------------------ */
  const doc = leerHoja(hojaPorNombre(hojas, DOCUMENTOS.nombre), DOCUMENTOS);
  filasPorHoja[DOCUMENTOS.nombre] = doc.filas.length;
  for (const { fila, v } of doc.filas) {
    const m = destino(DOCUMENTOS.nombre, fila, v.identificador);
    if (!m) continue;
    const tipo = dosDigitos(v.tipoDocumento);
    const falla = !v.tipoDocumento
      ? ["Tipo Documento", "Está vacío"]
      : tipo === "01" && !v.numPedimento
        ? ["Numero Pedimento", "El pedimento (tipo 01) necesita su número"]
        : tipo !== "01" && !v.idenDocAduanero
          ? ["ID. Documentacion Aduanero", "Los documentos que no son pedimento necesitan su identificador"]
          : null;
    if (falla) {
      error(DOCUMENTOS.nombre, fila, m.identificador, falla[0], falla[1]);
      descartar(m);
      continue;
    }
    m.mercancia.documentos.push({
      tipoDocumento: tipo,
      numPedimento: v.numPedimento,
      idenDocAduanero: v.idenDocAduanero,
      rfcImpo: v.rfcImpo.toUpperCase(),
    });
  }

  return {
    mercancias: orden.filter((m) => porId.has(m.identificador)),
    errores: ordenarErrores(errores),
    filasPorHoja,
  };
}

/**
 * Convierte los repartos del archivo (IDs "OR000001"/"DE000002") en los de la
 * carta porte, con las paradas que ya tiene el viaje. `ids` es el resultado de
 * idsUbicacion(): clave de la parada → ID.
 */
export function resolverRepartos(
  items: MercanciaImportada[],
  ids: Map<string, string>
): { errores: ErrorImportacion[]; validas: MercanciaImportada[] } {
  const porId = new Map<string, string>();
  for (const [clave, id] of ids) porId.set(id, clave);
  const origenes = [...ids.values()].filter((i) => i.startsWith("OR"));
  const destinos = [...ids.values()].filter((i) => i.startsWith("DE"));
  const lista = (l: string[]) => (l.length ? `hay ${l.join(", ")}` : "no hay ninguno");

  const errores: ErrorImportacion[] = [];
  const validas: MercanciaImportada[] = [];
  const hoja = CANTIDAD_TRANSPORTA.nombre;

  for (const item of items) {
    if (item.repartos.length === 0) {
      validas.push(item);
      continue;
    }
    let ok = true;
    const repartos = [];
    for (const r of item.repartos) {
      const origen = porId.get(r.idOrigen);
      const destino = porId.get(r.idDestino);
      if (!origen || !r.idOrigen.startsWith("OR")) {
        errores.push({ hoja, fila: r.fila, identificador: item.identificador, columna: "ID Origen", mensaje: `${r.idOrigen || "(vacío)"} no es un origen de esta carta porte (${lista(origenes)})` });
        ok = false;
      } else if (!destino || !r.idDestino.startsWith("DE")) {
        errores.push({ hoja, fila: r.fila, identificador: item.identificador, columna: "ID Destino", mensaje: `${r.idDestino || "(vacío)"} no es un destino de esta carta porte (${lista(destinos)})` });
        ok = false;
      } else {
        repartos.push({ cantidad: r.cantidad, origen, destino });
      }
    }
    const suma = item.repartos.reduce((a, r) => a + Number(r.cantidad), 0);
    const cantidad = Number(item.mercancia.cantidad);
    if (ok && Math.abs(suma - cantidad) > 1e-6) {
      errores.push({
        hoja,
        fila: item.repartos[0].fila,
        identificador: item.identificador,
        columna: "Cantidad",
        mensaje: `Reparte ${suma.toLocaleString("es-MX")} y la mercancía tiene ${cantidad.toLocaleString("es-MX")}`,
      });
      ok = false;
    }
    if (ok) validas.push({ ...item, mercancia: { ...item.mercancia, cantidadTransporta: repartos } });
  }
  return { errores, validas };
}
