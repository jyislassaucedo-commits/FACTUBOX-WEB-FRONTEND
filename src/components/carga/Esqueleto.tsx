import { cx } from "@/components/ui/styles";

/**
 * Piezas de esqueleto para los loading.tsx de cada ruta.
 *
 * No llevan "use client": son marcado estatico con una animacion de CSS, y
 * Next las renderiza al instante mientras el Server Component de la ruta
 * espera al PHP.
 *
 * Por que esqueleto y no un spinner centrado: el esqueleto conserva la FORMA
 * de lo que viene. El usuario ve de inmediato que va a haber una tabla de
 * emisores, no una mancha girando, y cuando llegan los datos nada salta de
 * lugar. Un spinner centrado tira la maqueta y luego la reconstruye.
 */

export function Bloque({ className }: { className?: string }) {
  return (
    <div
      className={cx("animate-pulso rounded-md bg-line-2", className)}
      aria-hidden
    />
  );
}

/** Cabecera de pantalla: titulo y subtitulo. */
export function EsqueletoEncabezado() {
  return (
    <div className="space-y-2">
      <Bloque className="h-6 w-48" />
      <Bloque className="h-3.5 w-72 max-w-full" />
    </div>
  );
}

/** Tabla con avatar, dos lineas de texto y dos pastillas por fila. */
export function EsqueletoTabla({ filas = 6 }: { filas?: number }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="border-b border-line-2 bg-surface-2 px-5 py-3">
        <Bloque className="h-2.5 w-24" />
      </div>
      {Array.from({ length: filas }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-4 border-b border-line-2 px-5 py-3.5 last:border-b-0"
          // Cada fila entra con un desfase pequeño. Sin esto, seis bloques
          // pulsando al unisono laten como una alarma; escalonados leen como
          // contenido en camino.
          style={{ animationDelay: `${i * 70}ms` }}
        >
          <Bloque className="h-9 w-9 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <Bloque className="h-3.5 w-1/3 min-w-[120px]" />
            <Bloque className="h-3 w-24" />
          </div>
          <Bloque className="h-5 w-16 shrink-0 rounded-full" />
          <Bloque className="h-5 w-24 shrink-0 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** Tarjeta generica: titulo, descripcion y unas lineas de cuerpo. */
export function EsqueletoTarjeta({ lineas = 3 }: { lineas?: number }) {
  return (
    <div className="rounded-2xl border border-line bg-surface">
      <div className="space-y-2 border-b border-line-2 px-5 py-4">
        <Bloque className="h-4 w-40" />
        <Bloque className="h-3 w-64 max-w-full" />
      </div>
      <div className="space-y-2.5 px-5 py-4">
        {Array.from({ length: lineas }).map((_, i) => (
          <Bloque
            key={i}
            className="h-3.5"
            // Anchos decrecientes: imitan parrafos reales en vez de barras
            // identicas, que se ven como una plantilla sin terminar.
            {...{ style: { width: `${92 - i * 14}%` } }}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Envoltorio de los loading.tsx.
 *
 * `aria-busy` y el texto para lector de pantalla existen porque el esqueleto es
 * puramente visual: sin esto, quien navega con lector percibe exactamente el
 * mismo silencio que teniamos antes.
 */
export function PantallaEsqueleto({
  children,
  mensaje,
}: {
  children: React.ReactNode;
  mensaje: string;
}) {
  return (
    <div aria-busy="true" className="space-y-5">
      <span className="sr-only" role="status" aria-live="polite">
        {mensaje}
      </span>
      {children}
    </div>
  );
}
