"use client";

import { useState } from "react";
import { Button, Field, FieldError, Input, Pill, Select, cx } from "@/components/ui";
import { CLAVES_UNIDAD, TASAS_IVA } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import type { ConceptoInput } from "@/lib/timbrado";

const TASAS_IEPS = [
  { value: "", label: "Sin IEPS" },
  { value: "0.080000", label: "8%" },
  { value: "0.265000", label: "26.5%" },
  { value: "0.300000", label: "30%" },
  { value: "0.530000", label: "53%" },
];

const RETENCIONES_ISR = [
  { value: "", label: "Sin retención" },
  { value: "0.100000", label: "10% ISR" },
  { value: "0.012500", label: "1.25% ISR" },
];

export function ConceptoEditor({
  concepto,
  indice,
  onChange,
  onRemove,
  puedeEliminar,
  errores,
  mostrarErrores,
}: {
  concepto: ConceptoInput;
  indice: number;
  onChange: (c: ConceptoInput) => void;
  onRemove: () => void;
  puedeEliminar: boolean;
  /** Errores del borrador, ya filtrados a este concepto: campo → mensaje. */
  errores: Record<string, string>;
  mostrarErrores: boolean;
}) {
  const [avanzado, setAvanzado] = useState(
    concepto.iepsTasa !== "" || concepto.retencionIsrTasa !== ""
  );

  const err = (campo: string) => (mostrarErrores ? errores[campo] : undefined);
  const importe = (Number(concepto.cantidad) || 0) * (Number(concepto.valorUnitario) || 0);
  const conError = mostrarErrores && Object.keys(errores).length > 0;

  function set(cambios: Partial<ConceptoInput>) {
    onChange({ ...concepto, ...cambios });
  }

  return (
    <div
      className={cx(
        "rounded-xl border bg-surface p-4 transition",
        conError ? "border-danger/50 bg-danger-bg/30" : "border-line"
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Pill tone={conError ? "danger" : "neutral"}>Concepto {indice + 1}</Pill>
          {importe > 0 && (
            <span className="font-mono text-[13px] font-semibold text-ink">
              {money(importe)}
            </span>
          )}
        </span>
        {puedeEliminar && (
          <Button variant="danger" size="sm" onClick={onRemove}>
            Quitar
          </Button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-12">
        <Field label="Descripción" className="sm:col-span-12">
          <Input
            value={concepto.descripcion}
            placeholder="Qué estás cobrando"
            onChange={(e) => set({ descripcion: e.target.value })}
            aria-invalid={Boolean(err("descripcion"))}
          />
          <FieldError mensaje={err("descripcion")} />
        </Field>

        <Field
          label="Clave producto/servicio"
          hint="Catálogo c_ClaveProdServ del SAT."
          className="sm:col-span-4"
        >
          <Input
            className="font-mono"
            inputMode="numeric"
            maxLength={8}
            placeholder="01010101"
            value={concepto.claveProdServ}
            onChange={(e) => set({ claveProdServ: e.target.value.replace(/\D/g, "") })}
            aria-invalid={Boolean(err("claveProdServ"))}
          />
          <FieldError mensaje={err("claveProdServ")} />
        </Field>

        <Field label="Unidad" className="sm:col-span-4">
          <Select
            value={concepto.claveUnidad}
            onChange={(e) => {
              const opcion = CLAVES_UNIDAD.find((u) => u.value === e.target.value);
              set({
                claveUnidad: e.target.value,
                unidad: opcion?.label.split(" - ")[1] ?? e.target.value,
              });
            }}
          >
            {CLAVES_UNIDAD.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("claveUnidad")} />
        </Field>

        <Field label="Cantidad" className="sm:col-span-2">
          <Input
            type="number"
            min={0}
            step="any"
            className="font-mono"
            value={concepto.cantidad}
            onChange={(e) => set({ cantidad: parseFloat(e.target.value) || 0 })}
            aria-invalid={Boolean(err("cantidad"))}
          />
          <FieldError mensaje={err("cantidad")} />
        </Field>

        <Field label="Precio unitario" className="sm:col-span-2">
          <Input
            type="number"
            min={0}
            step="0.01"
            className="font-mono"
            value={concepto.valorUnitario}
            onChange={(e) => set({ valorUnitario: parseFloat(e.target.value) || 0 })}
            aria-invalid={Boolean(err("valorUnitario"))}
          />
          <FieldError mensaje={err("valorUnitario")} />
        </Field>

        <Field label="IVA" className="sm:col-span-4">
          <Select
            value={concepto.ivaTasa}
            onChange={(e) => set({ ivaTasa: e.target.value })}
          >
            {TASAS_IVA.map((t) => (
              <option key={t.value || "exento"} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>

        {avanzado ? (
          <>
            <Field label="IEPS" className="sm:col-span-4">
              <Select
                value={concepto.iepsTasa}
                onChange={(e) => set({ iepsTasa: e.target.value })}
              >
                {TASAS_IEPS.map((t) => (
                  <option key={t.value || "no"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Retención" className="sm:col-span-4">
              <Select
                value={concepto.retencionIsrTasa}
                onChange={(e) => set({ retencionIsrTasa: e.target.value })}
              >
                {RETENCIONES_ISR.map((t) => (
                  <option key={t.value || "no"} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
          </>
        ) : (
          <div className="flex items-end sm:col-span-8">
            <button
              type="button"
              onClick={() => setAvanzado(true)}
              className="focus-brand rounded text-[12.5px] font-medium text-brand hover:underline"
            >
              + Agregar IEPS o retención
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
