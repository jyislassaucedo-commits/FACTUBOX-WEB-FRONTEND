"use client";

import { useState } from "react";
import { Card, CardBody, CardHeader, cx } from "@/components/ui";

/**
 * Envoltura de cada gráfica del tablero.
 *
 * Trae el interruptor "Tabla" a propósito: es el equivalente accesible de la
 * gráfica (WCAG) y además cubre la advertencia de contraste del validador de
 * paleta — tres de los tonos categóricos quedan por debajo de 3:1 sobre fondo
 * claro, y la regla es que en ese caso debe existir una vista con los valores
 * legibles. No es un extra: es requisito.
 */
export function ChartCard({
  titulo,
  descripcion,
  accion,
  tabla,
  alto = 264,
  vacio,
  leyenda,
  children,
}: {
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  /** Encabezados y filas de la vista de tabla. */
  tabla: { columnas: string[]; filas: Array<Array<string | number>> };
  /** Alto del área de dibujo, ya contando la banda del eje X. */
  alto?: number;
  /** Mensaje cuando no hay datos. */
  vacio?: string;
  /**
   * Leyenda. Va FUERA de la caja de alto fijo a propósito: si se mete dentro
   * junto con el gráfico, el alto no le alcanza y queda recortada.
   */
  leyenda?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [verTabla, setVerTabla] = useState(false);
  const sinDatos = tabla.filas.length === 0;

  return (
    <Card>
      <CardHeader
        title={titulo}
        description={descripcion}
        action={
          <div className="flex items-center gap-1">
            {accion}
            <div className="flex gap-0.5 rounded-lg border border-line bg-surface-2 p-0.5">
              <button
                type="button"
                onClick={() => setVerTabla(false)}
                aria-pressed={!verTabla}
                className={cx(
                  "focus-brand rounded-md px-2 py-1 text-[11.5px] font-semibold transition",
                  !verTabla ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink"
                )}
              >
                Gráfica
              </button>
              <button
                type="button"
                onClick={() => setVerTabla(true)}
                aria-pressed={verTabla}
                className={cx(
                  "focus-brand rounded-md px-2 py-1 text-[11.5px] font-semibold transition",
                  verTabla ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink"
                )}
              >
                Tabla
              </button>
            </div>
          </div>
        }
      />

      {sinDatos ? (
        <CardBody>
          <p className="py-10 text-center text-[13px] text-ink-3">
            {vacio ?? "Sin datos en este periodo."}
          </p>
        </CardBody>
      ) : verTabla ? (
        <div className="max-h-[320px] overflow-auto">
          <table className="w-full border-collapse text-left">
            <thead className="sticky top-0">
              <tr>
                {tabla.columnas.map((c, i) => (
                  <th
                    key={c}
                    className={cx(
                      "whitespace-nowrap border-b border-line-2 bg-surface-2 px-5 py-2 text-[10.8px] font-bold uppercase tracking-[0.07em] text-ink-3",
                      i > 0 && "text-right"
                    )}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabla.filas.map((fila, i) => (
                <tr key={i} className="transition hover:bg-surface-2">
                  {fila.map((celda, j) => (
                    <td
                      key={j}
                      className={cx(
                        "border-b border-line-2 px-5 py-2 text-[12.5px]",
                        j === 0
                          ? "text-ink"
                          : "text-right font-mono tabular-nums text-ink-2"
                      )}
                    >
                      {celda}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <CardBody>
          <div style={{ height: alto }}>{children}</div>
          {leyenda}
        </CardBody>
      )}
    </Card>
  );
}

/** Tooltip común a todas las gráficas. */
export function VizTooltip({
  titulo,
  filas,
}: {
  titulo: string;
  filas: Array<{ label: string; valor: string; color?: string }>;
}) {
  return (
    <div className="rounded-lg border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="text-[12.5px] font-semibold text-ink">{titulo}</p>
      <ul className="mt-1 space-y-0.5">
        {filas.map((f) => (
          <li key={f.label} className="flex items-center gap-2 text-[12px]">
            {f.color && (
              <span
                aria-hidden
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: f.color }}
              />
            )}
            <span className="text-ink-3">{f.label}</span>
            <span className="ml-auto font-mono tabular-nums font-semibold text-ink">
              {f.valor}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Leyenda propia: la de Recharts no respeta los tokens de texto. */
export function VizLeyenda({
  series,
}: {
  series: Array<{ label: string; color: string }>;
}) {
  return (
    <ul className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {series.map((s) => (
        <li key={s.label} className="flex items-center gap-1.5 text-[12px] text-ink-2">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-sm"
            style={{ background: s.color }}
          />
          {s.label}
        </li>
      ))}
    </ul>
  );
}
