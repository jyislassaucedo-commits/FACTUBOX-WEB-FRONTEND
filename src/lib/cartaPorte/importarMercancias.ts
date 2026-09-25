import type { MercanciaCP } from "@/lib/cartaPorteShared";
import type { MercanciaViaje } from "./borrador";
import { leerPlantillaMercancias, tituloColumna, type ErrorImportacion, type HojaExcel, type MercanciaImportada } from "./plantillaMercancias";

/*
   La importación de mercancías en el navegador: se lee el archivo (read-excel-file
   descomprime el .xlsx en su propio Web Worker), se revisa el formato y luego
   las claves contra los catálogos del SAT en tandas de 500 filas, una tras
   otra, para no cargar al servidor.

   Lo que ya se preguntó queda en `cache`: si una tanda falla y se reintenta,
   las anteriores no se vuelven a preguntar.
*/

export const FILAS_POR_TANDA = 500;
export const MERCANCIAS_POR_GUARDADO = 1000;

type FilaSat = { id: string; texto?: string; [c: string]: string | undefined };
/** tabla → clave → fila del catálogo, o null si no existe o ya no está vigente. */
export type CacheSat = Map<string, Map<string, FilaSat | null>>;

type Revision = {
  tabla: string;
  /** Las claves a revisar de una mercancía. */
  claves: (m: MercanciaViaje) => string[];
  hoja: string;
  columna: string;
  extra?: string[];
  nombre: string;
};

const PROD_CP = "SAT_CCP_PRODUCTOS_SERVICIOS";
const UNIDADES = "SAT_CFDI_CLAVES_UNIDADES";

const campo = (c: keyof MercanciaCP) => (m: MercanciaViaje) => (m[c] ? [String(m[c])] : []);

const REVISIONES: Revision[] = [
  { tabla: PROD_CP, claves: campo("claveprodcp"), hoja: "Mercancia", columna: tituloColumna("claveprodcp"), extra: ["material_peligroso"], nombre: "el catálogo de carta porte" },
  { tabla: "SAT_CFDI_PRODUCTOS_SERVICIOS", claves: campo("claveprod"), hoja: "Mercancia", columna: tituloColumna("claveprod"), nombre: "el catálogo de productos y servicios" },
  { tabla: UNIDADES, claves: campo("claveuni"), hoja: "Mercancia", columna: tituloColumna("claveuni"), nombre: "el catálogo de unidades" },
  { tabla: "SAT_CFDI_MONEDAS", claves: campo("moneda"), hoja: "Mercancia", columna: tituloColumna("moneda"), nombre: "el catálogo de monedas" },
  { tabla: "SAT_CCP_MATERIALES_PELIGROSOS", claves: campo("clavepeligroso"), hoja: "Mercancia", columna: tituloColumna("clavepeligroso"), nombre: "el catálogo de materiales peligrosos" },
  { tabla: "SAT_CCP_TIPOS_EMBALAJE", claves: campo("embalaje"), hoja: "Mercancia", columna: tituloColumna("embalaje"), nombre: "el catálogo de embalajes" },
  { tabla: "SAT_CCP_TIPOS_MATERIA", claves: campo("TipoMateria"), hoja: "Mercancia", columna: tituloColumna("TipoMateria"), nombre: "el catálogo de tipos de materia" },
  { tabla: "SAT_CCP_SECTORES_COFEPRIS", claves: campo("sectorcofepris"), hoja: "Sector COFEPRIS", columna: "Sector COFEPRIS", nombre: "el catálogo de sectores COFEPRIS" },
  { tabla: "SAT_CCP_FORMAS_FARMACEUTICAS", claves: campo("FormaFarmaceutica"), hoja: "Sector COFEPRIS", columna: "Forma Farmaceutica", nombre: "el catálogo de formas farmacéuticas" },
  { tabla: "SAT_CCP_CONDICIONES_ESPECIALES", claves: campo("CondicionesEspTransp"), hoja: "Sector COFEPRIS", columna: "Condiciones Especiales de Transporte", nombre: "el catálogo de condiciones especiales" },
  { tabla: "SAT_CCP_DOCUMENTOS_ADUANEROS", claves: (m) => m.documentos.map((d) => d.tipoDocumento), hoja: "Documentacion Aduanera", columna: "Tipo Documento", nombre: "el catálogo de documentos aduaneros" },
];

/** Las hojas del archivo, tal como vienen. */
export async function leerArchivoExcel(archivo: File): Promise<HojaExcel[]> {
  const { default: leer } = await import("read-excel-file/browser");
  const hojas = await leer(archivo);
  return hojas.map((h) => ({ sheet: h.sheet, data: h.data as HojaExcel["data"] }));
}

export { leerPlantillaMercancias };

export type Avance = {
  hechas: number;
  total: number;
  tanda: number;
  tandas: number;
  listas: number;
  conError: number;
  peso: number;
};

/** Pausar / cancelar desde la pantalla mientras se revisa. */
export type Control = { pausado: boolean; cancelado: boolean };

export class ImportacionCancelada extends Error {}

const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function preguntar(claves: Record<string, string[]>, extra: Record<string, string[]>) {
  let ultimo: unknown = null;
  for (let intento = 0; intento < 3; intento++) {
    try {
      const res = await fetch("/api/catalogos/sat/existen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ claves, extra }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudieron revisar las claves");
      return body.existen as Record<string, Record<string, FilaSat>>;
    } catch (e) {
      ultimo = e;
      await espera(800 * (intento + 1));
    }
  }
  throw ultimo instanceof Error ? ultimo : new Error("No se pudieron revisar las claves");
}

/**
 * Revisa las claves de cada mercancía contra los catálogos del SAT, tanda por
 * tanda. Devuelve las que pasan (ya ajustadas: texto de la unidad, material
 * peligroso según su clave) y los errores de las demás.
 */
export async function revisarContraSat(
  items: MercanciaImportada[],
  {
    cache,
    control,
    onAvance,
  }: { cache: CacheSat; control: Control; onAvance: (a: Avance) => void }
): Promise<{ validas: MercanciaImportada[]; errores: ErrorImportacion[] }> {
  const validas: MercanciaImportada[] = [];
  const errores: ErrorImportacion[] = [];
  const tandas = Math.max(1, Math.ceil(items.length / FILAS_POR_TANDA));
  let peso = 0;
  let conError = 0;

  for (let t = 0; t < tandas; t++) {
    while (control.pausado && !control.cancelado) await espera(250);
    if (control.cancelado) throw new ImportacionCancelada();

    const tanda = items.slice(t * FILAS_POR_TANDA, (t + 1) * FILAS_POR_TANDA);

    // Solo se pregunta lo que no se ha preguntado antes.
    const claves: Record<string, string[]> = {};
    const extra: Record<string, string[]> = {};
    for (const r of REVISIONES) {
      const ya = cache.get(r.tabla) ?? new Map<string, FilaSat | null>();
      cache.set(r.tabla, ya);
      const nuevas = new Set<string>();
      for (const it of tanda) for (const c of r.claves(it.mercancia)) if (!ya.has(c)) nuevas.add(c);
      if (nuevas.size) {
        claves[r.tabla] = [...nuevas];
        if (r.extra) extra[r.tabla] = r.extra;
      }
    }
    if (Object.keys(claves).length) {
      const existen = await preguntar(claves, extra);
      for (const [tabla, lista] of Object.entries(claves)) {
        const ya = cache.get(tabla)!;
        for (const c of lista) ya.set(c, existen[tabla]?.[c] ?? null);
      }
    }

    for (const it of tanda) {
      const m = it.mercancia;
      // Se señala en la fila de la mercancía; si el dato vino de otra hoja, se dice cuál.
      const mal = (hoja: string, columna: string, mensaje: string) =>
        errores.push({
          hoja: "Mercancia",
          fila: it.fila,
          identificador: it.identificador,
          columna: hoja === "Mercancia" ? columna : `${columna} (hoja ${hoja})`,
          mensaje,
        });
      let ok = true;

      for (const r of REVISIONES) {
        for (const c of r.claves(m)) {
          if (cache.get(r.tabla)!.get(c) === null) {
            mal(r.hoja, r.columna, `${c} no existe en ${r.nombre} o ya no está vigente`);
            ok = false;
          }
        }
      }

      // Material peligroso: lo decide la clave de bienes transportados.
      const mp = cache.get(PROD_CP)!.get(m.claveprodcp)?.material_peligroso ?? "0";
      if (!mp.includes("1")) {
        // El SAT no admite el atributo en claves que no son peligrosas.
        Object.assign(m, { materialpeligroso: "", clavepeligroso: "", embalaje: "", descembalaje: "" });
      } else {
        if (mp === "1" && !m.materialpeligroso) m.materialpeligroso = "Sí";
        if (!m.materialpeligroso) {
          mal("Mercancia", tituloColumna("materialpeligroso"), `La clave ${m.claveprodcp} puede ser material peligroso: indica Sí o No`);
          ok = false;
        } else if (m.materialpeligroso === "Sí" && (!m.clavepeligroso || !m.embalaje)) {
          mal("Mercancia", tituloColumna(m.clavepeligroso ? "embalaje" : "clavepeligroso"), `La clave ${m.claveprodcp} es de material peligroso: falta ${m.clavepeligroso ? "el embalaje" : "la clave del material y el embalaje"}`);
          ok = false;
        } else if (m.materialpeligroso === "No") {
          Object.assign(m, { clavepeligroso: "", embalaje: "", descembalaje: "" });
        }
      }

      if (!m.unidad) m.unidad = (cache.get(UNIDADES)!.get(m.claveuni)?.texto ?? "").slice(0, 20);

      if (ok) {
        validas.push(it);
        peso += Number(m.pesoTotal) || 0;
      } else {
        conError++;
      }
    }

    onAvance({
      hechas: Math.min(items.length, (t + 1) * FILAS_POR_TANDA),
      total: items.length,
      tanda: t + 1,
      tandas,
      listas: validas.length,
      conError,
      peso,
    });
  }
  return { validas, errores };
}

/** Las columnas de CP_MERCANCIA de una mercancía del viaje (sin lo propio del viaje). */
export function filaCatalogo(m: MercanciaViaje): Record<string, string> {
  const {
    clave: _c, identificador: _i, cantidad: _q, pesoTotal: _p, uuidComercioExt: _u, claveSTCC: _s,
    cantidadTransporta: _ct, documentos: _d, guias: _g, detalle: _dt, id: _id, ...cat
  } = m as MercanciaViaje & { id?: number };
  void [_c, _i, _q, _p, _u, _s, _ct, _d, _g, _dt, _id];
  const fila: Record<string, string> = {};
  for (const [k, v] of Object.entries(cat)) if (typeof v === "string") fila[k] = v;
  return fila;
}

/** Guarda en el catálogo en tandas de 1000; devuelve cuántas eran nuevas. */
export async function guardarEnCatalogo(
  rfc: string,
  mercancias: MercanciaViaje[],
  onAvance: (hechas: number) => void
): Promise<number> {
  // La misma clave, descripción y unidad es la misma mercancía: se manda una vez.
  const unicas = new Map<string, Record<string, string>>();
  for (const m of mercancias) {
    const f = filaCatalogo(m);
    unicas.set(`${f.claveprodcp}|${f.descripcion.slice(0, 150)}|${f.claveuni}`, f);
  }
  const filas = [...unicas.values()];
  let nuevas = 0;
  for (let i = 0; i < filas.length; i += MERCANCIAS_POR_GUARDADO) {
    const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/mercancias-lote`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filas: filas.slice(i, i + MERCANCIAS_POR_GUARDADO) }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "No se pudieron guardar en el catálogo");
    nuevas += Number(body.nuevas) || 0;
    onAvance(Math.min(filas.length, i + MERCANCIAS_POR_GUARDADO));
  }
  return nuevas;
}

/** Los errores como CSV (Excel lo abre con acentos gracias al BOM). */
export function erroresCsv(errores: ErrorImportacion[]): Blob {
  const esc = (s: string | number) => {
    const t = String(s);
    return /[",\n;]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const lineas = [
    ["Hoja", "Fila", "Identificador", "Columna", "Qué pasa"].join(","),
    ...errores.map((e) => [e.hoja, e.fila, e.identificador, e.columna, e.mensaje].map(esc).join(",")),
  ];
  return new Blob(["﻿" + lineas.join("\r\n")], { type: "text/csv;charset=utf-8" });
}
