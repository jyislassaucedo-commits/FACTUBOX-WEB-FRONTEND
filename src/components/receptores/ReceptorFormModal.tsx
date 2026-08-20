"use client";

import { useState } from "react";
import { REGIMENES_FISCALES, USOS_CFDI } from "@/lib/catalogosSat";
import type { Receptor, ReceptorInput } from "@/lib/receptores";

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

const VACIO: ReceptorInput = {
  rfc: "",
  nombre: "",
  regimenFiscal: "",
  domicilioFiscal: "",
  usoCfdi: "",
  correoElectronico: "",
};

export function ReceptorFormModal({
  rfcEmisor,
  onClose,
  onSaved,
}: {
  rfcEmisor: string;
  onClose: () => void;
  onSaved: (receptor: Receptor) => void;
}) {
  const [values, setValues] = useState<ReceptorInput>(VACIO);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const input: ReceptorInput = {
        rfc: values.rfc.trim().toUpperCase(),
        nombre: values.nombre.trim(),
        regimenFiscal: values.regimenFiscal,
        domicilioFiscal: values.domicilioFiscal.trim(),
        usoCfdi: values.usoCfdi,
        correoElectronico: values.correoElectronico?.trim() || undefined,
      };

      const res = await fetch(`/api/empresas/${encodeURIComponent(rfcEmisor)}/receptores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar el receptor");
        return;
      }

      onSaved({
        Rfc: input.rfc,
        Nombre: input.nombre,
        RegimenFiscal: input.regimenFiscal,
        DomicilioFiscal: input.domicilioFiscal,
        UsoCfdi: input.usoCfdi,
        CorreoElectronico: input.correoElectronico,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-900">Nuevo receptor</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-neutral-500 hover:text-neutral-700"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">RFC</label>
              <input
                className={inputClass}
                value={values.rfc}
                required
                maxLength={13}
                onChange={(e) => setValues({ ...values, rfc: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Código postal
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
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Nombre / Razón social
            </label>
            <input
              className={inputClass}
              value={values.nombre}
              required
              onChange={(e) => setValues({ ...values, nombre: e.target.value })}
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Régimen fiscal
              </label>
              <select
                className={inputClass}
                value={values.regimenFiscal}
                required
                onChange={(e) => setValues({ ...values, regimenFiscal: e.target.value })}
              >
                <option value="">Selecciona</option>
                {REGIMENES_FISCALES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-neutral-600">
                Uso de CFDI
              </label>
              <select
                className={inputClass}
                value={values.usoCfdi}
                required
                onChange={(e) => setValues({ ...values, usoCfdi: e.target.value })}
              >
                <option value="">Selecciona</option>
                {USOS_CFDI.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-neutral-600">
              Correo electrónico (opcional)
            </label>
            <input
              type="email"
              className={inputClass}
              value={values.correoElectronico}
              onChange={(e) => setValues({ ...values, correoElectronico: e.target.value })}
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar receptor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
