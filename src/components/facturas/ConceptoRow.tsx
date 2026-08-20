"use client";

import { useState } from "react";
import { CLAVES_UNIDAD, TASAS_IVA } from "@/lib/catalogosSat";
import type { ConceptoInput } from "@/lib/timbrado";

const inputClass =
  "w-full rounded-lg border border-neutral-300 px-2 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-500";

export function ConceptoRow({
  concepto,
  onChange,
  onRemove,
  puedeEliminar,
}: {
  concepto: ConceptoInput;
  onChange: (c: ConceptoInput) => void;
  onRemove: () => void;
  puedeEliminar: boolean;
}) {
  const [avanzado, setAvanzado] = useState(
    concepto.iepsTasa !== "" || concepto.retencionIsrTasa !== ""
  );
  const importe = round2(concepto.cantidad * concepto.valorUnitario);

  return (
    <div className="rounded-lg border border-neutral-200 p-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-12">
        <div className="sm:col-span-4">
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Descripción
          </label>
          <input
            className={inputClass}
            value={concepto.descripcion}
            onChange={(e) => onChange({ ...concepto, descripcion: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Clave prod/serv
          </label>
          <input
            className={inputClass}
            placeholder="01010101"
            value={concepto.claveProdServ}
            onChange={(e) => onChange({ ...concepto, claveProdServ: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Unidad</label>
          <select
            className={inputClass}
            value={concepto.claveUnidad}
            onChange={(e) => {
              const opt = CLAVES_UNIDAD.find((u) => u.value === e.target.value);
              onChange({
                ...concepto,
                claveUnidad: e.target.value,
                unidad: opt ? opt.label.split(" - ")[1] : concepto.unidad,
              });
            }}
          >
            {CLAVES_UNIDAD.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div className="sm:col-span-1">
          <label className="mb-1 block text-xs font-medium text-neutral-600">Cant.</label>
          <input
            type="number"
            min="0"
            step="1"
            className={inputClass}
            value={concepto.cantidad}
            onChange={(e) =>
              onChange({ ...concepto, cantidad: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Precio unitario
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            className={inputClass}
            value={concepto.valorUnitario}
            onChange={(e) =>
              onChange({ ...concepto, valorUnitario: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div className="flex items-end justify-between sm:col-span-1">
          <span className="text-sm text-neutral-700">${importe.toFixed(2)}</span>
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">IVA</label>
          <select
            className={inputClass}
            value={concepto.ivaTasa}
            onChange={(e) => onChange({ ...concepto, ivaTasa: e.target.value })}
          >
            {TASAS_IVA.map((t) => (
              <option key={t.label} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setAvanzado(!avanzado)}
          className="mt-4 text-xs font-medium text-neutral-500 hover:underline"
        >
          {avanzado ? "Ocultar IEPS/retención" : "Agregar IEPS o retención"}
        </button>

        {puedeEliminar && (
          <button
            type="button"
            onClick={onRemove}
            className="ml-auto mt-4 text-xs font-medium text-red-600 hover:underline"
          >
            Quitar concepto
          </button>
        )}
      </div>

      {avanzado && (
        <div className="mt-2 flex flex-wrap gap-3 border-t border-neutral-100 pt-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              IEPS (tasa, ej. 0.08 = 8%)
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              max="1"
              placeholder="Sin IEPS"
              className={`${inputClass} w-32`}
              value={concepto.iepsTasa}
              onChange={(e) => onChange({ ...concepto, iepsTasa: e.target.value })}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Retención ISR (tasa, ej. 0.0125)
            </label>
            <input
              type="number"
              step="0.0001"
              min="0"
              max="1"
              placeholder="Sin retención"
              className={`${inputClass} w-36`}
              value={concepto.retencionIsrTasa}
              onChange={(e) => onChange({ ...concepto, retencionIsrTasa: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
