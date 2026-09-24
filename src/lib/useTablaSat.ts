"use client";

import { useEffect, useState } from "react";

/*
   Catálogos del SAT por nombre de tabla (carta porte y geografía), del lado
   del navegador. Los chicos se piden una vez y quedan en memoria para toda la
   pestaña, igual que useCatalogoSat; los grandes se buscan por texto.
*/

export type FilaSat = { id: string; texto?: string; [columna: string]: string | undefined };

const cache = new Map<string, FilaSat[]>();
const enVuelo = new Map<string, Promise<FilaSat[]>>();

function pedir(tabla: string): Promise<FilaSat[]> {
  const existente = enVuelo.get(tabla);
  if (existente) return existente;
  const promesa = fetch(`/api/catalogos/sat?tabla=${encodeURIComponent(tabla)}`)
    .then((res) => res.json())
    .then((body) => (body.resultados ?? []) as FilaSat[])
    .catch(() => [] as FilaSat[]);
  enVuelo.set(tabla, promesa);
  return promesa;
}

/** Un catálogo chico completo (vigente), cacheado. Mientras carga devuelve []. */
export function useTablaSat(tabla: string): FilaSat[] {
  // Lo cacheado se lee directo; el estado solo sirve para volver a pintar
  // cuando llega la respuesta.
  const [llegada, setLlegada] = useState<{ tabla: string; filas: FilaSat[] } | null>(null);
  useEffect(() => {
    if (cache.has(tabla)) return;
    let vivo = true;
    pedir(tabla).then((filas) => {
      if (filas.length > 0) cache.set(tabla, filas);
      else enVuelo.delete(tabla);
      if (vivo) setLlegada({ tabla, filas });
    });
    return () => {
      vivo = false;
    };
  }, [tabla]);
  return cache.get(tabla) ?? (llegada?.tabla === tabla ? llegada.filas : []);
}

/** Búsqueda en un catálogo grande (estaciones, materiales peligrosos...). */
export async function buscarEnTablaSat(tabla: string, q: string, medio?: string): Promise<FilaSat[]> {
  const params = new URLSearchParams({ tabla, q });
  if (medio) params.set("medio", medio);
  const res = await fetch(`/api/catalogos/sat?${params}`);
  if (!res.ok) return [];
  const body = await res.json();
  return (body.resultados ?? []) as FilaSat[];
}

export type InfoCodigoPostal = {
  codigoPostal: {
    id: string;
    estado: string;
    estado_texto: string | null;
    municipio: string;
    municipio_texto: string | null;
    localidad: string;
    localidad_texto: string | null;
  } | null;
  colonias: Array<{ id: string; texto: string }>;
};

const cps = new Map<string, InfoCodigoPostal>();

/** Estado, municipio, localidad y colonias de un CP de México; null si no se pudo consultar. */
export async function consultarCp(cp: string): Promise<InfoCodigoPostal | null> {
  if (!/^\d{5}$/.test(cp)) return null;
  const guardado = cps.get(cp);
  if (guardado) return guardado;
  const res = await fetch(`/api/catalogos/cp/${cp}`);
  if (!res.ok) return null;
  const body = (await res.json()) as InfoCodigoPostal;
  cps.set(cp, body);
  return body;
}
