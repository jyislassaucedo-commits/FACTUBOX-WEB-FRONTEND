"use client";

import { useState } from "react";
import {
  Button,
  Field,
  FileDrop,
  Input,
  Note,
  Pill,
  Select,
  cx,
} from "@/components/ui";
import { REGIMENES_FISCALES } from "@/lib/catalogosSat";
import type { EmisorInput } from "@/lib/emisores";

export type EmisorFormValues = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
};

export function EmisorForm({
  initial,
  rfcEditable,
  logoActual,
  onSubmit,
}: {
  initial: EmisorFormValues;
  rfcEditable: boolean;
  /** Logo ya guardado (base64), solo para previsualizar en edición. */
  logoActual?: string;
  onSubmit: (values: EmisorInput) => Promise<string | null>;
}) {
  const [values, setValues] = useState(initial);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const sucio =
    logoFile !== null ||
    values.rfc !== initial.rfc ||
    values.nombre !== initial.nombre ||
    values.regimenFiscal !== initial.regimenFiscal ||
    values.domicilioFiscal !== initial.domicilioFiscal;

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
      } else {
        setLogoFile(null);
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="RFC"
            hint={rfcEditable ? "12 o 13 caracteres." : "El RFC no se puede cambiar; crea otro emisor."}
            badge={!rfcEditable && <Pill>bloqueado</Pill>}
          >
            <Input
              className="font-mono"
              value={values.rfc}
              readOnly={!rfcEditable}
              required
              maxLength={13}
              onChange={(e) => setValues({ ...values, rfc: e.target.value.toUpperCase() })}
            />
          </Field>

          <Field label="Código postal (lugar de expedición)" hint="5 dígitos, como en tu constancia.">
            <Input
              className="font-mono"
              value={values.domicilioFiscal}
              required
              maxLength={5}
              pattern="[0-9]{5}"
              title="5 dígitos"
              onChange={(e) => setValues({ ...values, domicilioFiscal: e.target.value })}
            />
          </Field>

          <Field label="Razón social" className="sm:col-span-2">
            <Input
              value={values.nombre}
              required
              onChange={(e) => setValues({ ...values, nombre: e.target.value })}
            />
          </Field>

          <Field label="Régimen fiscal" className="sm:col-span-2">
            <Select
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
            </Select>
          </Field>
        </div>

        <div className="space-y-3">
          <p className="text-xs font-semibold text-ink-2">Logotipo (opcional)</p>
          {logoActual && !logoFile && (
            <div className="flex items-center gap-3 rounded-xl border border-line bg-surface-2 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${logoActual}`}
                alt="Logo actual"
                className="h-10 w-16 rounded object-contain"
              />
              <span className="text-[12px] text-ink-3">Logo actual</span>
            </div>
          )}
          <FileDrop
            label="Arrastra tu logo o haz clic"
            hint="PNG o JPG · ideal 240×80 px"
            accept="image/png,image/jpeg"
            file={logoFile}
            onFile={setLogoFile}
          />
          <Note tone="info">
            Si un diseño de PDF tiene su propio logo, ese gana sobre éste.
          </Note>
        </div>
      </div>

      {error && (
        <div className="mt-4">
          <Note tone="danger" title="No se pudo guardar">
            {error}
          </Note>
        </div>
      )}

      {/* Barra de guardado: solo aparece cuando hay cambios reales. */}
      <div
        className={cx(
          "sticky bottom-3 mt-5 flex items-center justify-between gap-3 rounded-xl bg-ink px-4 py-2.5 shadow-pop transition",
          sucio && !rfcEditable
            ? "opacity-100"
            : "pointer-events-none absolute translate-y-3 opacity-0"
        )}
      >
        <span className="text-[12.8px] font-medium text-background">
          Tienes cambios sin guardar
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setValues(initial);
              setLogoFile(null);
              setError(null);
            }}
            className="focus-brand rounded-[10px] px-3 py-1.5 text-[13px] font-medium text-background/80 transition hover:text-background"
          >
            Descartar
          </button>
          <Button type="submit" variant="primary" size="sm" disabled={saving}>
            {saving ? "Guardando..." : "Guardar cambios"}
          </Button>
        </div>
      </div>

      {/* En alta de emisor no hay "cambios sin guardar" que descartar: se
          necesita un boton visible siempre. */}
      {rfcEditable && (
        <div className="mt-4">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? "Guardando..." : "Guardar emisor"}
          </Button>
        </div>
      )}
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
