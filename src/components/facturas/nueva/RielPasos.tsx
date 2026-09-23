"use client";

import { cx } from "@/components/ui";
import type { PasoId } from "@/lib/facturaNueva";

/*
   Los pasos del comprobante, uno por renglón. Es la lista de la propuesta B
   del mockup: con siete pasos, ponerlos en fila los amontonaba.

   El verde es la señal que pidió el usuario: un paso ya visitado y SIN nada
   pendiente. Un paso visitado con algo pendiente lleva "!" y dice cuánto
   falta; uno que todavía no toca, su número en gris.
*/

export type EstadoPaso = "actual" | "hecho" | "falta" | "pendiente";

export type PasoRiel = {
  id: PasoId;
  titulo: string;
  estado: EstadoPaso;
  /** Lo elegido en el paso, o cuánto falta. */
  resumen?: string;
  habilitado: boolean;
};

export function RielPasos({
  tipo,
  folio,
  icono,
  pasos,
  onIr,
}: {
  tipo: string;
  folio: string;
  icono: React.ReactNode;
  pasos: PasoRiel[];
  onIr: (id: PasoId) => void;
}) {
  return (
    <nav
      aria-label="Pasos del comprobante"
      className="min-w-0 rounded-card border border-line bg-surface p-3 lg:sticky lg:top-20 lg:p-4"
    >
      <div className="flex items-center gap-2.5 border-b border-line pb-3">
        {icono}
        <span className="min-w-0">
          <span className="block text-[14px] font-bold text-ink">{tipo}</span>
          <span className="block font-mono text-[12px] text-ink-3">{folio}</span>
        </span>
      </div>

      <ol className="mt-2 flex gap-1 overflow-x-auto pb-1 lg:block lg:space-y-0.5 lg:overflow-visible lg:pb-0">
        {pasos.map((p, i) => {
          const marca = p.estado === "hecho" ? "✓" : p.estado === "falta" ? "!" : i + 1;
          return (
            <li key={p.id} className="flex-none">
              <button
                type="button"
                onClick={() => onIr(p.id)}
                disabled={!p.habilitado}
                aria-current={p.estado === "actual" ? "step" : undefined}
                className={cx(
                  "focus-brand relative flex w-full items-center gap-2.5 rounded-[9px] px-2 py-2 text-left transition",
                  p.habilitado && p.estado !== "actual" && "hover:bg-line-2",
                  !p.habilitado && "cursor-default"
                )}
              >
                <span
                  aria-hidden
                  className={cx(
                    "grid size-6 flex-none place-items-center rounded-full border-[1.5px] text-[12px] font-bold",
                    p.estado === "hecho" && "border-ok bg-ok text-white",
                    p.estado === "actual" && "border-brand bg-brand text-brand-ink",
                    p.estado === "falta" && "border-warn bg-warn-bg text-warn",
                    p.estado === "pendiente" && "border-line bg-surface text-ink-3"
                  )}
                >
                  {marca}
                </span>
                <span className="min-w-0">
                  <span
                    className={cx(
                      "block whitespace-nowrap text-[13.5px] font-semibold leading-tight lg:whitespace-normal",
                      p.estado === "hecho" && "text-ok",
                      p.estado === "actual" && "text-brand-600",
                      p.estado === "falta" && "text-warn",
                      p.estado === "pendiente" && "text-ink-3"
                    )}
                  >
                    {p.titulo}
                  </span>
                  {p.resumen && (
                    <span className="hidden truncate text-[12px] text-ink-3 lg:block">{p.resumen}</span>
                  )}
                  <span className="sr-only">
                    {p.estado === "hecho" ? " (completo)" : p.estado === "falta" ? " (falta algo)" : ""}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
