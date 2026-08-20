"use client";

import { useEffect, useState } from "react";
import { TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import type { Serie } from "@/lib/series";

const inputClass =
  "rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

type NuevaSerie = { nombre: string; tipo: string; inicio: string };

const VACIA: NuevaSerie = { nombre: "", tipo: "I", inicio: "1" };

export function SeriesSection({ rfc }: { rfc: string }) {
  const [series, setSeries] = useState<Serie[]>([]);
  const [loading, setLoading] = useState(true);
  const [nueva, setNueva] = useState<NuevaSerie>(VACIA);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function cargar() {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/series`)
      .then((res) => res.json())
      .then((body) => setSeries(body.series ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, [rfc]);

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nueva.nombre.trim() || !nueva.inicio) {
      setError("Escribe el nombre de la serie y el folio inicial.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nueva),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo crear la serie");
        return;
      }

      setNueva(VACIA);
      cargar();
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(serie: Serie) {
    setError(null);
    const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/series`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: serie.Nombre, tipo: serie.Tipo }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "No se pudo eliminar la serie");
      return;
    }
    cargar();
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">Series y folios</h2>
      <p className="mt-1 text-sm text-neutral-600">
        Cada serie lleva su propio consecutivo de folio, según el tipo de comprobante.
      </p>

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Cargando...</p>
      ) : series.length > 0 ? (
        <table className="mt-4 w-full text-left text-sm">
          <thead className="text-xs font-medium uppercase text-neutral-500">
            <tr>
              <th className="py-1.5 pr-2">Serie</th>
              <th className="py-1.5 pr-2">Tipo</th>
              <th className="py-1.5 pr-2">Folio inicial</th>
              <th></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100">
            {series.map((serie) => (
              <tr key={`${serie.Tipo}-${serie.Nombre}`}>
                <td className="py-1.5 pr-2 font-medium text-neutral-900">{serie.Nombre}</td>
                <td className="py-1.5 pr-2 text-neutral-700">
                  {TIPO_LABELS[serie.Tipo] ?? serie.Tipo}
                </td>
                <td className="py-1.5 pr-2 text-neutral-700">{serie.Inicio}</td>
                <td className="py-1.5 text-right">
                  <button
                    type="button"
                    onClick={() => handleEliminar(serie)}
                    className="text-xs font-medium text-red-600 hover:underline"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-neutral-500">Sin series todavía.</p>
      )}

      <form onSubmit={handleAgregar} className="mt-4 flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Serie</label>
          <input
            className={`${inputClass} w-24`}
            placeholder="A"
            value={nueva.nombre}
            onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">Tipo</label>
          <select
            className={inputClass}
            value={nueva.tipo}
            onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}
          >
            {TIPO_ORDEN.map((tipo) => (
              <option key={tipo} value={tipo}>
                {TIPO_LABELS[tipo]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-neutral-600">
            Folio inicial
          </label>
          <input
            type="number"
            min="1"
            className={`${inputClass} w-28`}
            value={nueva.inicio}
            onChange={(e) => setNueva({ ...nueva, inicio: e.target.value })}
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          {saving ? "Agregando..." : "Agregar serie"}
        </button>
      </form>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
