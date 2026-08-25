"use client";

import { useEffect, useState } from "react";
import type { CatalogoCompleto } from "./catalogoSatBusquedaShared";

// Módulo compartido por toda la pestaña: RegimenFiscal/UsoCFDI no cambian
// mientras el usuario arma una factura, así que basta pedirlos una vez aunque
// el mismo catálogo se use en varios formularios a la vez (emisor, receptor).
const cache = new Map<CatalogoCompleto, unknown[]>();
const enVuelo = new Map<CatalogoCompleto, Promise<unknown[]>>();

function pedir(catalogo: CatalogoCompleto): Promise<unknown[]> {
  const existente = enVuelo.get(catalogo);
  if (existente) return existente;

  const promesa = fetch(`/api/catalogos/obtener?catalogo=${catalogo}`)
    .then((res) => res.json())
    .then((body) => (body.resultados ?? []) as unknown[])
    .catch(() => [] as unknown[]);

  enVuelo.set(catalogo, promesa);
  return promesa;
}

/** Catálogo SAT completo (RegimenFiscal, UsoCFDI), cacheado en memoria para toda la pestaña. */
export function useCatalogoSat<T>(catalogo: CatalogoCompleto): T[] {
  const [datos, setDatos] = useState<T[]>((cache.get(catalogo) as T[]) ?? []);

  useEffect(() => {
    const enCache = cache.get(catalogo);
    if (enCache) {
      setDatos(enCache as T[]);
      return;
    }
    let vivo = true;
    pedir(catalogo).then((resultado) => {
      cache.set(catalogo, resultado);
      if (vivo) setDatos(resultado as T[]);
    });
    return () => {
      vivo = false;
    };
  }, [catalogo]);

  return datos;
}
