"use client";

import { useEffect, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { TIMBRES_BAJOS, type Timbres } from "@/lib/timbresShared";

/**
 * Saldo de timbres en la barra superior.
 *
 * Se muestra en todas las pantallas porque es del usuario, no del emisor: sin
 * timbres no se puede timbrar nada, y enterarse al momento de emitir es tarde.
 * El detalle (utilizados, cancelados) va en un desplegable para no cargar la
 * barra con tres números que casi nadie necesita al mismo tiempo.
 */
export function TimbresBadge({ timbres }: { timbres: Timbres }) {
  const [abierto, setAbierto] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!abierto) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setAbierto(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setAbierto(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [abierto]);

  const agotado = timbres.disponibles <= 0;
  const bajo = !agotado && timbres.disponibles <= TIMBRES_BAJOS;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={abierto}
        onClick={() => setAbierto((v) => !v)}
        title={
          agotado
            ? "Te quedaste sin timbres: no vas a poder emitir"
            : `${timbres.disponibles} timbres disponibles`
        }
        className={cx(
          "focus-brand flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition",
          agotado
            ? "border-danger/40 bg-danger-bg text-danger"
            : bajo
              ? "border-warn/40 bg-warn-bg text-warn"
              : "border-line bg-surface-2 text-ink-2 hover:border-ink-4 hover:text-ink"
        )}
      >
        <span
          aria-hidden
          className={cx(
            "h-1.5 w-1.5 rounded-full",
            agotado ? "bg-danger" : bajo ? "bg-warn" : "bg-ok"
          )}
        />
        <span className="font-mono tabular-nums">{timbres.disponibles}</span>
        <span className="hidden font-sans font-medium sm:inline">
          {timbres.disponibles === 1 ? "timbre" : "timbres"}
        </span>
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Saldo de timbres"
          className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 rounded-xl border border-line bg-surface p-3.5 shadow-pop"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
            Timbres de tu cuenta
          </p>

          <p
            className={cx(
              "mt-2 text-2xl font-bold leading-none tracking-tight",
              agotado ? "text-danger" : bajo ? "text-warn" : "text-ink"
            )}
          >
            {timbres.disponibles}
          </p>
          <p className="mt-1 text-[11.5px] text-ink-3">disponibles para emitir</p>

          {/* El tablero muestra el consumo del ejercicio; aquí es el histórico de
              la cuenta. Se etiqueta para que no parezcan el mismo dato mal sumado. */}
          <p className="mt-3 border-t border-line-2 pt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-ink-4">
            Consumo histórico
          </p>
          <dl className="mt-1.5 space-y-1.5">
            <Renglon etiqueta="Usados en timbrado" valor={timbres.utilizados} />
            <Renglon etiqueta="Usados en cancelación" valor={timbres.cancelados} />
          </dl>

          {(agotado || bajo) && (
            <p
              className={cx(
                "mt-3 rounded-lg px-3 py-2 text-[12px] leading-relaxed",
                agotado ? "bg-danger-bg text-danger" : "bg-warn-bg text-warn"
              )}
            >
              {agotado
                ? "Sin timbres no puedes emitir ni cancelar comprobantes. Contacta a tu distribuidor para recargar."
                : "Te quedan pocos: conviene recargar antes de que se acaben."}
            </p>
          )}

          <p className="mt-3 text-[11px] leading-relaxed text-ink-4">
            El saldo es de tu cuenta y lo comparten todos tus emisores. Cancelar
            un CFDI exige tener saldo, aunque no lo descuenta.
          </p>
        </div>
      )}
    </div>
  );
}

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-[12px] text-ink-3">{etiqueta}</dt>
      <dd className="font-mono tabular-nums text-[12.5px] font-semibold text-ink">
        {valor}
      </dd>
    </div>
  );
}
