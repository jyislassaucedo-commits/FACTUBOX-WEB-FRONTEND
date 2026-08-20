"use client";

import { useState } from "react";
import { REGIMENES_FISCALES } from "@/lib/catalogosSat";
import type { EmisorInput } from "@/lib/emisores";

export type EmisorFormValues = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

export function EmisorForm({
  initial,
  rfcEditable,
  onSubmit,
}: {
  initial: EmisorFormValues;
  rfcEditable: boolean;
  onSubmit: (values: EmisorInput) => Promise<string | null>;
}) {
  const [values, setValues] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      let logoBase64: string | undefined;
      let logoExtension: string | undefined;

      if (logoFile) {
        logoBase64 = await fileToBase64(logoFile);
        logoExtension = "." + (logoFile.name.split(".").pop() ?? "png");
      }

      const errorMsg = await onSubmit({
        rfc: values.rfc.trim().toUpperCase(),
        nombre: values.nombre.trim(),
        regimenFiscal: values.regimenFiscal,
        domicilioFiscal: values.domicilioFiscal.trim(),
        logoBase64,
        logoExtension,
      });

      if (errorMsg) {
        setError(errorMsg);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            RFC
          </label>
          <input
            className={inputClass}
            value={values.rfc}
            disabled={!rfcEditable}
            required
            maxLength={13}
            onChange={(e) => setValues({ ...values, rfc: e.target.value })}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700">
            Código postal (lugar de expedición)
          </label>
          <input
            className={inputClass}
            value={values.domicilioFiscal}
            required
            maxLength={5}
            pattern="[0-9]{5}"
            title="5 dígitos"
            onChange={(e) => setValues({ ...values, domicilioFiscal: e.target.value })}
          />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Razón social
        </label>
        <input
          className={inputClass}
          value={values.nombre}
          required
          onChange={(e) => setValues({ ...values, nombre: e.target.value })}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Régimen fiscal
        </label>
        <select
          className={inputClass}
          value={values.regimenFiscal}
          required
          onChange={(e) => setValues({ ...values, regimenFiscal: e.target.value })}
        >
          <option value="">Selecciona un régimen</option>
          {REGIMENES_FISCALES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700">
          Logo (opcional)
        </label>
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          className="block w-full text-sm text-neutral-600"
        />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50"
      >
        {saving ? "Guardando..." : "Guardar"}
      </button>
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
