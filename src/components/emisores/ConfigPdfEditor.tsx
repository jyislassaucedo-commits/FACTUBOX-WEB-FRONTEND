"use client";

import { useState } from "react";
import type { ConfigPdfForm } from "@/lib/configPdfShared";
import { PdfPreview } from "./PdfPreview";

const colorClass = "h-10 w-16 rounded border border-neutral-300";
const numberClass =
  "w-24 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";
const textClass =
  "w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

const TOGGLES: { key: keyof ConfigPdfForm; label: string }[] = [
  { key: "mostrarDecimales", label: "Mostrar decimales" },
  { key: "mostrarImpuestos", label: "Mostrar impuestos" },
  { key: "mostrarDescripSat", label: "Mostrar descripción SAT" },
  { key: "mostrarImpLocales", label: "Mostrar impuestos locales" },
  { key: "mostrarDescuentos", label: "Mostrar descuentos" },
  { key: "mostrarImportesCp", label: "Mostrar importe con letra" },
];

const COLORES: { key: keyof ConfigPdfForm; label: string }[] = [
  { key: "colorFondo", label: "Fondo" },
  { key: "colorContorno", label: "Contorno" },
  { key: "colorFuente", label: "Texto" },
  { key: "colorSeparador", label: "Separador" },
  { key: "colorTitulos", label: "Títulos" },
];

export function ConfigPdfEditor({
  rfc,
  emisorNombre,
  initial,
  nombreBloqueado,
  onCancel,
  onSaved,
}: {
  rfc: string;
  emisorNombre: string;
  initial: ConfigPdfForm;
  nombreBloqueado: boolean;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<ConfigPdfForm>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogo(file: File | null) {
    if (!file) return;
    const base64 = await fileToBase64(file);
    setForm((prev) => ({
      ...prev,
      imagenBase64: base64,
      imagenExtension: "." + (file.name.split(".").pop() ?? "png"),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.nombre.trim()) {
      setError("Escribe un nombre para esta configuración.");
      return;
    }

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

      onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      <div className="space-y-6">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Nombre de la configuración
          </label>
          <input
            className={textClass}
            placeholder="Ej. Predeterminada, Sucursal Centro..."
            value={form.nombre}
            disabled={nombreBloqueado}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Logo de esta configuración
          </label>
          <input
            type="file"
            accept="image/png,image/jpeg"
            onChange={(e) => handleLogo(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-neutral-600"
          />
        </div>

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
              className={`${textClass} mt-2 max-w-sm`}
              placeholder="Texto de la marca de agua"
              value={form.textoMarcaAgua}
              onChange={(e) => setForm({ ...form, textoMarcaAgua: e.target.value })}
            />
          )}
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar diseño"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
          >
            Cancelar
          </button>
        </div>
      </div>

      <PdfPreview form={form} emisorNombre={emisorNombre} logoBase64={form.imagenBase64} />
    </form>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
