import { cache } from "react";
import { callLegacyPhpApi } from "./phpApi";
import { getSession } from "./session";
import type { Timbres } from "./timbresShared";

export { TIMBRES_BAJOS } from "./timbresShared";
export type { Timbres } from "./timbresShared";

/**
 * Saldo de timbres del usuario (`getNumTimbradosV2.php`).
 *
 * Es dato del **usuario**, no del emisor: un mismo saldo alcanza a todas sus
 * empresas. Por eso se carga en el layout de la aplicación y se muestra en la
 * barra superior de todas las pantallas.
 *
 * Va envuelto en `cache()`: el layout y la página del tablero lo piden en el
 * mismo render y el backend recibe una sola llamada. El cache dura lo que dura
 * ese render, así que un `router.refresh()` después de timbrar trae el saldo ya
 * actualizado.
 */
export const getTimbres = cache(async (): Promise<Timbres | null> => {
  const session = await getSession();
  if (!session) return null;

  const resp = await callLegacyPhpApi<{
    TimbresDisponibles: string;
    TimbresCancelados: string;
    TimbresUtilizados: string;
  }>("/maa/mvc/Usuario_Timbre/api/getNumTimbradosV2.php", {
    Token: session.token,
  });

  // Ante un error se devuelve null y la UI simplemente no muestra el saldo:
  // más vale no enseñar nada que enseñar un número inventado.
  if (resp.Error !== "0") return null;

  return {
    disponibles: parseInt(resp.TimbresDisponibles, 10) || 0,
    utilizados: parseInt(resp.TimbresUtilizados, 10) || 0,
    cancelados: parseInt(resp.TimbresCancelados, 10) || 0,
  };
});
