"use client";

import { useEffect, useState } from "react";
import { useProgreso } from "@/components/carga/ProgresoProvider";
import { cx } from "@/components/ui/styles";

/** Debajo de esto no se muestra nada: el parpadeo se nota mas que la espera. */
const RETARDO_MS = 220;

/** Cuanto se queda el mensaje visible aunque la peticion ya haya terminado. */
const PERMANENCIA_MS = 260;

/**
 * Barra de progreso del encabezado.
 *
 * Tres decisiones que hacen la diferencia entre "informa" y "estorba":
 *
 * 1. RETARDO. Nada aparece durante los primeros 220 ms. Una peticion que
 *    termina en 80 ms no debe dejar rastro; un destello por clic se lee como
 *    un defecto, no como informacion. Solo lo lento se anuncia.
 *
 * 2. PERMANENCIA. Una vez visible, se queda un momento aunque la peticion ya
 *    haya vuelto. Aparecer y desaparecer en 30 ms produce un parpadeo peor que
 *    no haber mostrado nada.
 *
 * 3. INDETERMINADA. No finge un porcentaje. No sabemos cuanto tarda el PHP, y
 *    una barra que se planta en 90% mientras se espera miente sobre el avance.
 *    Se usa un recorrido continuo, que dice "sigo trabajando" sin prometer
 *    cuando termina.
 */
export function BarraProgreso() {
  const { operaciones } = useProgreso();

  // La barra ignora las bloqueantes: esas ya tienen la pantalla completa, y
  // mostrar las dos cosas a la vez duplica el ruido.
  const activas = operaciones.filter((op) => !op.bloqueante);
  const hayActividad = activas.length > 0;
  const mensaje = activas.length > 0 ? activas[activas.length - 1].mensaje : "";

  // Un solo estado con las dos cosas, y SIEMPRE escrito desde dentro de un
  // setTimeout, nunca en el cuerpo del efecto. Aparte de que React lo prefiere
  // (un setState sincrono en un efecto encadena renders), aqui cae natural: el
  // mensaje se captura en el instante en que la barra se vuelve visible, y al
  // ocultarse solo se apaga `visible`, conservando el texto durante el fundido.
  const [mostrado, setMostrado] = useState({ visible: false, mensaje: "" });

  useEffect(() => {
    if (hayActividad) {
      const t = setTimeout(() => setMostrado({ visible: true, mensaje }), RETARDO_MS);
      return () => clearTimeout(t);
    }
    const t = setTimeout(
      () => setMostrado((previo) => ({ ...previo, visible: false })),
      PERMANENCIA_MS
    );
    return () => clearTimeout(t);
  }, [hayActividad, mensaje]);

  const { visible, mensaje: ultimoMensaje } = mostrado;

  return (
    <>
      {/* La barra vive fuera del flujo, pegada al borde inferior del
          encabezado. Al no ocupar alto, no empuja el contenido: aparecer no
          mueve nada de su lugar. */}
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 bottom-0 h-[2.5px] overflow-hidden transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        aria-hidden
      >
        <div className="h-full w-2/5 rounded-full bg-brand animate-barra-progreso" />
      </div>

      {/* El texto va aparte, como pastilla flotante bajo el encabezado. Es la
          parte que responde "que estoy esperando", no solo "algo pasa". */}
      <div
        className={cx(
          "pointer-events-none absolute left-1/2 top-[calc(100%+8px)] z-30 -translate-x-1/2 transition-all duration-200",
          visible ? "translate-y-0 opacity-100" : "-translate-y-1 opacity-0"
        )}
        // aria-live: un lector de pantalla anuncia el mensaje cuando cambia.
        // "polite" y no "assertive" porque esto no debe interrumpir lo que el
        // usuario este escuchando.
        role="status"
        aria-live="polite"
      >
        <span className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[11.5px] font-medium text-ink-2 shadow-pop">
          <Girador />
          {ultimoMensaje}
        </span>
      </div>
    </>
  );
}

function Girador() {
  return (
    <svg width="11" height="11" viewBox="0 0 24 24" className="shrink-0 animate-spin" aria-hidden>
      <circle
        cx="12"
        cy="12"
        r="9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        className="text-line"
      />
      <path
        d="M12 3a9 9 0 019 9"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        className="text-brand"
      />
    </svg>
  );
}
