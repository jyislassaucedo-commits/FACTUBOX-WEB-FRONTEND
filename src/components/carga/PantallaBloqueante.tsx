"use client";

import { useEffect, useState } from "react";
import { useOperacionBloqueante } from "@/components/carga/ProgresoProvider";
import { cx } from "@/components/ui/styles";

/** A partir de aqui se agrega la nota de "esto esta tardando". */
const TARDANZA_MS = 6000;

/**
 * Pantalla de espera para operaciones que no se pueden repetir.
 *
 * A diferencia de la barra, esta NO tiene retardo: aparece de inmediato. Su
 * trabajo principal no es informar sino impedir el segundo clic, y un timbrado
 * duplicado no se arregla con un mensaje de disculpa. Como solo la disparan
 * operaciones que de por si tardan segundos, no hay riesgo de destello.
 *
 * Cubre toda la ventana a proposito, encabezado incluido: durante un timbrado
 * no hay ninguna otra cosa util que el usuario pueda hacer, y dejar el menu
 * accesible solo invita a navegar a media escritura en el SAT.
 */
export function PantallaBloqueante() {
  const operacion = useOperacionBloqueante();

  // Se guarda el ID de la operacion que se tardo, no un booleano. Asi no hace
  // falta apagar la bandera al terminar —una operacion nueva trae otro id, y
  // `tardando` sale falso solo— y todo el estado se escribe desde dentro del
  // setTimeout, sin setState sincrono en el cuerpo del efecto.
  const [idTardado, setIdTardado] = useState<number | null>(null);
  const tardando = operacion !== null && idTardado === operacion.id;

  useEffect(() => {
    if (!operacion) return;
    const t = setTimeout(() => setIdTardado(operacion.id), TARDANZA_MS);
    return () => clearTimeout(t);
  }, [operacion]);

  // Mientras haya una operacion bloqueante, Escape y Tab no deben sacar al
  // usuario de aqui. Se bloquea el scroll del documento por la misma razon.
  useEffect(() => {
    if (!operacion) return;
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = overflowPrevio;
    };
  }, [operacion]);

  if (!operacion) return null;

  return (
    <div
      // role="alertdialog" + aria-modal: los lectores de pantalla anuncian el
      // mensaje y entienden que el resto de la pagina quedo inerte.
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-label={operacion.mensaje}
      className="fixed inset-0 z-[100] grid place-items-center bg-bg/80 backdrop-blur-sm"
    >
      <div className="mx-4 flex w-full max-w-xs flex-col items-center gap-4 rounded-2xl border border-line bg-surface px-6 py-7 text-center shadow-pop">
        <GiradorGrande />

        <div className="space-y-1">
          <p className="text-[14px] font-semibold leading-snug text-ink">
            {operacion.mensaje}
          </p>
          <p className="text-[12.5px] leading-snug text-ink-3">
            No cierres esta ventana.
          </p>
        </div>

        {/* El aviso de tardanza aparece solo si de verdad se tardo. Ponerlo
            desde el principio ensenaria a ignorarlo; a los 6 segundos, en
            cambio, contesta la pregunta que el usuario ya se esta haciendo. */}
        <p
          className={cx(
            "text-[11.5px] leading-snug text-ink-4 transition-opacity duration-300",
            tardando ? "opacity-100" : "opacity-0"
          )}
          aria-live="polite"
        >
          {tardando ? "Está tardando más de lo normal. Sigue en proceso." : " "}
        </p>
      </div>
    </div>
  );
}

function GiradorGrande() {
  return (
    <svg width="38" height="38" viewBox="0 0 24 24" className="animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        className="text-line"
      />
      <path
        d="M12 2.5a9.5 9.5 0 019.5 9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        className="text-brand"
      />
    </svg>
  );
}
