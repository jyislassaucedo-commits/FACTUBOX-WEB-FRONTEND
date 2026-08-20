"use client";

import { useCallback, useState } from "react";
import { useProgreso } from "@/components/carga/ProgresoProvider";

/**
 * Envuelve una llamada al servidor para que el indicador global la conozca.
 *
 * Devuelve tambien `pendiente`, para que el boton que la disparo pueda
 * deshabilitarse y cambiar su texto. Las dos cosas son necesarias y no
 * sobran una a la otra: el indicador global responde "la aplicacion esta
 * ocupada", el estado del boton responde "ESTE boton fue el que apreté". Sin
 * el segundo, el usuario vuelve a hacer clic en el mismo lugar.
 *
 * Uso:
 *
 *   const { ejecutar, pendiente } = useAccionServidor();
 *
 *   <Button
 *     disabled={pendiente}
 *     onClick={() =>
 *       ejecutar("Guardando emisor…", async () => {
 *         const res = await fetch("/api/empresas", { ... });
 *         ...
 *       })
 *     }
 *   >
 *     {pendiente ? "Guardando…" : "Guardar"}
 *   </Button>
 *
 * Para operaciones que no se pueden repetir (timbrar, subir CSD, cambiar
 * contrasena) se pasa `{ bloqueante: true }` y en vez de la barra sale la
 * pantalla completa.
 */
export function useAccionServidor() {
  const { iniciar } = useProgreso();
  const [pendiente, setPendiente] = useState(false);

  const ejecutar = useCallback(
    async function <T>(
      mensaje: string,
      accion: () => Promise<T>,
      opciones?: { bloqueante?: boolean }
    ): Promise<T> {
      const terminar = iniciar(mensaje, opciones?.bloqueante ?? false);
      setPendiente(true);
      try {
        return await accion();
      } finally {
        // finally y no despues del await: si la accion lanza —red caida, JSON
        // roto, un throw del propio codigo— el indicador TIENE que apagarse.
        // Un spinner eterno es peor que el congelamiento que vino a resolver.
        terminar();
        setPendiente(false);
      }
    },
    [iniciar]
  );

  return { ejecutar, pendiente };
}

/**
 * Variante para trabajo que no nace de un clic: efectos que cargan datos al
 * montar, router.refresh() dentro de startTransition, etc.
 *
 * No expone `pendiente` porque no hay un boton al que reportarle; solo alimenta
 * el indicador global.
 */
export function useProgresoManual() {
  const { iniciar } = useProgreso();
  return useCallback(
    (mensaje: string, bloqueante = false) => iniciar(mensaje, bloqueante),
    [iniciar]
  );
}
