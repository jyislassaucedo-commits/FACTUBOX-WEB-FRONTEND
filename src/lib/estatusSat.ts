/* ---------------------------------------------------------------------------
   Validación de estatus ante el SAT desde el cliente.
   ---------------------------------------------------------------------------
   Sin dependencias de servidor: lo usan tanto el listado (validación en lote)
   como el panel de detalle (una sola factura).
--------------------------------------------------------------------------- */

import type { Factura } from "@/lib/facturasShared";

/** Debe coincidir con MAX_POR_TANDA en /api/facturas/estatus. */
export const TANDA = 8;

export type ResultadoEstatus = {
  uuid: string;
  ok: boolean;
  estado?: string;
  esCancelable?: string;
  estatusCancelacion?: string;
  codigoEstatus?: string;
  error?: string;
};

export type Avance = { hechas: number; total: number };

/**
 * Consulta el SAT en tandas y va reportando el avance.
 *
 * Se parte la lista porque cada consulta es una llamada SOAP de ~1 segundo:
 * mandar 200 de golpe reventaría el timeout y dejaría al usuario sin saber
 * cuántas alcanzaron a validarse.
 */
export async function validarEstatusSat(
  facturas: Factura[],
  onAvance: (avance: Avance) => void
): Promise<ResultadoEstatus[]> {
  const resultados: ResultadoEstatus[] = [];
  const total = facturas.length;

  for (let i = 0; i < total; i += TANDA) {
    const tanda = facturas.slice(i, i + TANDA);

    try {
      const res = await fetch("/api/facturas/estatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: tanda.map((f) => ({
            uuid: f.Uuid,
            rfcEmisor: f.Rfc,
            rfcReceptor: f.RfcReceptor,
            total: f.Total,
          })),
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        // Falla toda la tanda: se marca factura por factura para no perder
        // el rastro de cuáles quedaron sin validar.
        resultados.push(
          ...tanda.map((f) => ({
            uuid: f.Uuid,
            ok: false,
            error: body.error ?? "No se pudo consultar el SAT",
          }))
        );
      } else {
        resultados.push(...(body.resultados as ResultadoEstatus[]));
      }
    } catch {
      resultados.push(
        ...tanda.map((f) => ({
          uuid: f.Uuid,
          ok: false,
          error: "No se pudo conectar con el servidor",
        }))
      );
    }

    onAvance({ hechas: Math.min(i + TANDA, total), total });
  }

  return resultados;
}

/** Resumen legible de una corrida, para el toast final. */
export function resumirValidacion(resultados: ResultadoEstatus[]) {
  const ok = resultados.filter((r) => r.ok);
  const fallidas = resultados.length - ok.length;
  const porEstado = ok.reduce<Record<string, number>>((acc, r) => {
    const estado = r.estado || "Sin estado";
    acc[estado] = (acc[estado] ?? 0) + 1;
    return acc;
  }, {});

  const partes = Object.entries(porEstado).map(([estado, n]) => `${n} ${estado.toLowerCase()}`);
  if (fallidas > 0) partes.push(`${fallidas} con error`);

  return partes.length > 0 ? partes.join(" · ") : "Sin resultados";
}
