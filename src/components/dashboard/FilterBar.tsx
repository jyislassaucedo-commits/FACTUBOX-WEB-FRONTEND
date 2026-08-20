"use client";

import type { Emisor } from "@/lib/emisores";
import { MESES, TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";

export type Filtros = {
  rfc: string;
  anio: number;
  mes: string; // "" = todo el año, o "1".."12"
  tipo: string;
};

const selectClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500 sm:w-48";

export function FilterBar({
  emisores,
  filtros,
  onChange,
}: {
  emisores: Emisor[];
  filtros: Filtros;
  onChange: (filtros: Filtros) => void;
}) {
  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: 5 }, (_, i) => anioActual - i);

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Emisor
        </label>
        <select
          className={selectClass}
          value={filtros.rfc}
          onChange={(e) => onChange({ ...filtros, rfc: e.target.value })}
        >
          <option value="">Todos</option>
          {emisores.map((emisor) => (
            <option key={emisor.Rfc} value={emisor.Rfc}>
              {emisor.Nombre || emisor.Rfc}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Año
        </label>
        <select
          className={selectClass}
          value={filtros.anio}
          onChange={(e) => onChange({ ...filtros, anio: parseInt(e.target.value, 10) })}
        >
          {anios.map((anio) => (
            <option key={anio} value={anio}>
              {anio}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Mes
        </label>
        <select
          className={selectClass}
          value={filtros.mes}
          onChange={(e) => onChange({ ...filtros, mes: e.target.value })}
        >
          <option value="">Todos</option>
          {MESES.map((mes, i) => (
            <option key={mes} value={i + 1}>
              {mes}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-neutral-600">
          Tipo de comprobante
        </label>
        <select
          className={selectClass}
          value={filtros.tipo}
          onChange={(e) => onChange({ ...filtros, tipo: e.target.value })}
        >
          <option value="TODO">Todos</option>
          {TIPO_ORDEN.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TIPO_LABELS[tipo]}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
