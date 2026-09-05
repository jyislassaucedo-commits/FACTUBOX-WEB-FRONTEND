"use client";

import { useEffect, useState } from "react";
import { CATALOGOS_NOMINA_VACIOS, type CatalogosNomina } from "./catalogosNominaShared";

// Los catorce catalogos no cambian mientras alguien captura empleados, asi que
// se piden una vez por pestaña aunque haya varios formularios abiertos.
let cache: CatalogosNomina | null = null;
let enVuelo: Promise<CatalogosNomina> | null = null;

function pedir(): Promise<CatalogosNomina> {
  if (enVuelo) return enVuelo;
  enVuelo = fetch("/api/catalogos/nomina")
    .then((res) => res.json())
    .then((body) => (body.catalogos ?? CATALOGOS_NOMINA_VACIOS) as CatalogosNomina)
    .catch(() => CATALOGOS_NOMINA_VACIOS);
  return enVuelo;
}

/**
 * Catálogos del complemento de nómina, cacheados para toda la pestaña.
 *
 * El valor inicial sale del cache dentro del inicializador de useState, no de
 * un setState dentro del efecto: así un segundo formulario los tiene desde el
 * primer render y no hay una pasada extra de renderizado.
 */
export function useCatalogosNomina(): { catalogos: CatalogosNomina; cargando: boolean } {
  const [catalogos, setCatalogos] = useState<CatalogosNomina>(
    () => cache ?? CATALOGOS_NOMINA_VACIOS
  );
  const [cargando, setCargando] = useState(() => cache === null);

  useEffect(() => {
    if (cache !== null) return;
    let vivo = true;
    pedir().then((resultado) => {
      cache = resultado;
      if (!vivo) return;
      setCatalogos(resultado);
      setCargando(false);
    });
    return () => {
      vivo = false;
    };
  }, []);

  return { catalogos, cargando };
}
