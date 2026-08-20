"use client";

import { useEffect, useState } from "react";
import { CONFIG_PDF_DEFAULT, type ConfigPdfForm } from "@/lib/configPdfShared";

const colorClass = "h-10 w-16 rounded border border-neutral-300";
const numberClass =
  "w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

const TOGGLES: { key: keyof ConfigPdfForm; label: string }[] = [
  { key: "mostrarDecimales", label: "Mostrar decimales" },
  { key: "mostrarImpuestos", label: "Mostrar impuestos" },
  { key: "mostrarDescripSat", label: "Mostrar descripción SAT" },
  { key: "mostrarImpLocales", label: "Mostrar impuestos locales" },
  { key: "mostrarDescuentos", label: "Mostrar descuentos" },
  { key: "mostrarImportesCp", label: "Mostrar importes con letra" },
];

const COLORES: { key: keyof ConfigPdfForm; label: string }[] = [
  { key: "colorFondo", label: "Fondo" },
  { key: "colorContorno", label: "Contorno" },
  { key: "colorFuente", label: "Texto" },
  { key: "colorSeparador", label: "Separador" },
  { key: "colorTitulos", label: "Títulos" },
];

export function ConfigPdfSection({ rfc }: { rfc: string }) {
  const [form, setForm] = useState<ConfigPdfForm>(CONFIG_PDF_DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`)
      .then((res) => res.json())
      .then((body) => setForm(body.config ?? CONFIG_PDF_DEFAULT))
      .finally(() => setLoading(false));
  }, [rfc]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar la configuración");
        return;
      }

      setSuccess(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <p className="text-sm text-neutral-500">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-neutral-900">
        Diseño del PDF de facturas
      </h2>
      <p className="mt-1 text-sm text-neutral-600">
        Colores, logo y qué información incluir en el PDF que reciben tus clientes.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-6">
        <div>
          <p className="mb-2 text-xs font-medium text-neutral-600">Colores</p>
          <div className="flex flex-wrap gap-4">
            {COLORES.map(({ key, label }) => (
              <div key={key}>
                <label className="mb-1 block text-xs text-neutral-500">{label}</label>
                <input
                  type="color"
                  className={colorClass}
                  value={form[key] as string}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Tamaño de fuente
            </label>
            <input
              type="number"
              step="0.5"
              min="5"
              max="14"
              className={numberClass}
              value={form.tamanoFuente}
              onChange={(e) =>
                setForm({ ...form, tamanoFuente: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Grosor del separador
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="3"
              className={numberClass}
              value={form.grosorSeparador}
              onChange={(e) =>
                setForm({ ...form, grosorSeparador: parseFloat(e.target.value) || 0 })
              }
            />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-neutral-600">Contenido</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TOGGLES.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-2 text-sm text-neutral-700">
                <input
                  type="checkbox"
                  checked={form[key] as boolean}
                  onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="flex items-center gap-2 text-sm text-neutral-700">
            <input
              type="checkbox"
              checked={form.mostrarMarcaAgua}
              onChange={(e) => setForm({ ...form, mostrarMarcaAgua: e.target.checked })}
            />
            Mostrar marca de agua
          </label>
          {form.mostrarMarcaAgua && (
            <input
              className="mt-2 w-full max-w-sm rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500"
              placeholder="Texto de la marca de agua"
              value={form.textoMarcaAgua}
              onChange={(e) => setForm({ ...form, textoMarcaAgua: e.target.value })}
            />
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
            Configuración guardada.
          </p>
        )}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100 disabled:opacity-50"
        >
          {saving ? "Guardando..." : "Guardar diseño"}
        </button>
      </form>
    </div>
  );
}
