"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/styles";
import { SelectorCatalogoSat } from "@/components/catalogosSat/SelectorCatalogoSat";
import {
  aplicaPorRfc,
  usosCompatibles,
  type ResultadoRegimenFiscal,
  type ResultadoUsoCfdi,
} from "@/lib/catalogoSatBusquedaShared";
import { useCatalogoSat } from "@/lib/useCatalogoSat";
import type { Receptor, ReceptorInput } from "@/lib/receptores";

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

  const regimenes = useCatalogoSat<ResultadoRegimenFiscal>("regimenFiscal");
  const usos = useCatalogoSat<ResultadoUsoCfdi>("usoCfdi");
  const regimenesParaRfc = aplicaPorRfc(regimenes, values.rfc);
  const usosCompatiblesConRegimen = usosCompatibles(usos, values.regimenFiscal);

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
      <div className="absolute left-1/2 top-1/2 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-ink">Nuevo receptor</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-ink-3 hover:text-ink"
          >
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">RFC</label>
              <input
                className={inputClass}
                value={values.rfc}
                required
                maxLength={13}
                onChange={(e) => setValues({ ...values, rfc: e.target.value })}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">
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
            <label className="mb-1 block text-xs font-medium text-ink-2">
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
              <label className="mb-1 block text-xs font-medium text-ink-2">
                Régimen fiscal
              </label>
              <SelectorCatalogoSat<ResultadoRegimenFiscal>
                opciones={regimenesParaRfc}
                value={values.regimenFiscal}
                placeholder="Busca por nombre o clave"
                required
                onChange={(r) =>
                  setValues({
                    ...values,
                    regimenFiscal: r.id,
                    // El uso elegido puede dejar de ser válido para el nuevo régimen.
                    usoCfdi: usosCompatibles(usos, r.id).some((u) => u.id === values.usoCfdi)
                      ? values.usoCfdi
                      : "",
                  })
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">
                Uso de CFDI
              </label>
              <SelectorCatalogoSat<ResultadoUsoCfdi>
                opciones={usosCompatiblesConRegimen}
                value={values.usoCfdi}
                placeholder="Busca por nombre o clave"
                required
                onChange={(u) => setValues({ ...values, usoCfdi: u.id })}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">
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
            <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2"
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
