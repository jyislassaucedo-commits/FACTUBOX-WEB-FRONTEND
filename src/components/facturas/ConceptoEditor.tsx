"use client";

import { useState } from "react";
import { Button, Field, FieldError, Input, Pill, Select, cx } from "@/components/ui";
import {
  IMPUESTO_IEPS,
  IMPUESTO_ISR,
  IMPUESTO_IVA,
  TASAS_IEPS,
  TASAS_IVA,
  TASAS_RETENCION_ISR,
  TASAS_RETENCION_IVA,
} from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import type { ConceptoInput, ImpuestoConceptoInput, NaturalezaImpuesto } from "@/lib/timbrado";
import { BuscadorClaveSat } from "./BuscadorClaveSat";
import type { ResultadoClaveUnidad, ResultadoProductoServicio } from "@/lib/catalogoSatBusqueda";

const TIPOS_IMPUESTO = [
  { value: IMPUESTO_IVA, label: "IVA" },
  { value: IMPUESTO_IEPS, label: "IEPS" },
  { value: IMPUESTO_ISR, label: "ISR" },
];

const TASAS_IVA_TRASLADO = TASAS_IVA.filter((t) => t.value !== "");

/** Tasas que puede tomar un impuesto según su tipo y si es traslado o retención. */
function tasasPara(tipo: string, naturaleza: NaturalezaImpuesto) {
  if (tipo === IMPUESTO_IEPS) return TASAS_IEPS;
  if (tipo === IMPUESTO_ISR) return TASAS_RETENCION_ISR;
  return naturaleza === "traslado" ? TASAS_IVA_TRASLADO : TASAS_RETENCION_IVA;
}

/** Primera combinación tipo+naturaleza+tasa que un concepto todavía no usa. */
function siguienteImpuestoLibre(actuales: ImpuestoConceptoInput[]): ImpuestoConceptoInput | null {
  for (const tipo of [IMPUESTO_IVA, IMPUESTO_IEPS, IMPUESTO_ISR]) {
    const naturalezas: NaturalezaImpuesto[] = tipo === IMPUESTO_ISR ? ["retencion"] : ["traslado", "retencion"];
    for (const naturaleza of naturalezas) {
      const usadas = actuales
        .filter((i) => i.tipo === tipo && i.naturaleza === naturaleza)
        .map((i) => i.tasa);
      const libre = tasasPara(tipo, naturaleza).find((t) => !usadas.includes(t.value));
      if (libre) {
        return { id: crypto.randomUUID(), tipo, naturaleza, tasa: libre.value };
      }
    }
  }
  return null;
}

function FilaImpuesto({
  impuesto,
  tasasOcupadas,
  onChange,
  onRemove,
}: {
  impuesto: ImpuestoConceptoInput;
  /** Tasas que ya usan OTRAS filas del mismo tipo+naturaleza (no se pueden repetir). */
  tasasOcupadas: string[];
  onChange: (cambios: Partial<ImpuestoConceptoInput>) => void;
  onRemove: () => void;
}) {
  const esIsr = impuesto.tipo === IMPUESTO_ISR;
  const tasas = tasasPara(impuesto.tipo, impuesto.naturaleza).filter(
    (t) => t.value === impuesto.tasa || !tasasOcupadas.includes(t.value)
  );

  return (
    <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
      <Field label="Impuesto">
        <Select
          value={impuesto.tipo}
          onChange={(e) => {
            const tipo = e.target.value;
            const naturaleza: NaturalezaImpuesto = tipo === IMPUESTO_ISR ? "retencion" : impuesto.naturaleza;
            const primeraTasa = tasasPara(tipo, naturaleza)[0]?.value ?? "";
            onChange({ tipo, naturaleza, tasa: primeraTasa });
          }}
        >
          {TIPOS_IMPUESTO.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Tipo">
        <Select
          value={impuesto.naturaleza}
          disabled={esIsr}
          onChange={(e) => {
            const naturaleza = e.target.value as NaturalezaImpuesto;
            const primeraTasa = tasasPara(impuesto.tipo, naturaleza)[0]?.value ?? "";
            onChange({ naturaleza, tasa: primeraTasa });
          }}
        >
          <option value="traslado">Traslado</option>
          <option value="retencion">Retención</option>
        </Select>
      </Field>

      <Field label="Tasa">
        <Select value={impuesto.tasa} onChange={(e) => onChange({ tasa: e.target.value })}>
          {tasas.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </Field>

      <Button variant="danger" size="sm" onClick={onRemove}>
        Quitar
      </Button>
    </div>
  );
}

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
  const err = (campo: string) => (mostrarErrores ? errores[campo] : undefined);
  const importe = (Number(concepto.cantidad) || 0) * (Number(concepto.valorUnitario) || 0);
  const conError = mostrarErrores && Object.keys(errores).length > 0;

  const [textoProdServ, setTextoProdServ] = useState("");

  function set(cambios: Partial<ConceptoInput>) {
    onChange({ ...concepto, ...cambios });
  }

  function agregarImpuesto() {
    const nuevo = siguienteImpuestoLibre(concepto.impuestos);
    if (nuevo) set({ impuestos: [...concepto.impuestos, nuevo] });
  }

  function cambiarImpuesto(id: string, cambios: Partial<ImpuestoConceptoInput>) {
    set({ impuestos: concepto.impuestos.map((i) => (i.id === id ? { ...i, ...cambios } : i)) });
  }

  function quitarImpuesto(id: string) {
    set({ impuestos: concepto.impuestos.filter((i) => i.id !== id) });
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
          hint="Busca por palabra o escribe la clave si ya la sabes."
          className="sm:col-span-4"
        >
          <BuscadorClaveSat<ResultadoProductoServicio>
            catalogo="productoServicio"
            valorId={concepto.claveProdServ}
            valorTexto={textoProdServ}
            placeholder="Ej. servicios de facturación, 01010101…"
            invalid={Boolean(err("claveProdServ"))}
            onEscribir={(valor) => {
              setTextoProdServ("");
              set({ claveProdServ: valor });
            }}
            onElegir={(r) => {
              setTextoProdServ(r.texto);
              set({ claveProdServ: r.id });
            }}
          />
          <FieldError mensaje={err("claveProdServ")} />
        </Field>

        <Field label="Unidad" className="sm:col-span-4">
          <BuscadorClaveSat<ResultadoClaveUnidad>
            catalogo="claveUnidad"
            valorId={concepto.claveUnidad}
            valorTexto={concepto.unidad}
            placeholder="Ej. pieza, kilogramo, H87…"
            invalid={Boolean(err("claveUnidad"))}
            onEscribir={(valor) => set({ claveUnidad: valor, unidad: valor })}
            onElegir={(r) => set({ claveUnidad: r.id, unidad: r.texto })}
          />
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

        <div className="space-y-2 sm:col-span-12">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-ink-2">Impuestos</span>
            {siguienteImpuestoLibre(concepto.impuestos) && (
              <button
                type="button"
                onClick={agregarImpuesto}
                className="focus-brand rounded text-[12.5px] font-medium text-brand hover:underline"
              >
                + Agregar impuesto
              </button>
            )}
          </div>

          {concepto.impuestos.length === 0 && (
            <p className="text-[12.5px] text-ink-4">
              Sin impuestos: el concepto queda exento (sin objeto de impuesto).
            </p>
          )}

          {concepto.impuestos.map((imp) => (
            <FilaImpuesto
              key={imp.id}
              impuesto={imp}
              tasasOcupadas={concepto.impuestos
                .filter((i) => i.id !== imp.id && i.tipo === imp.tipo && i.naturaleza === imp.naturaleza)
                .map((i) => i.tasa)}
              onChange={(cambios) => cambiarImpuesto(imp.id, cambios)}
              onRemove={() => quitarImpuesto(imp.id)}
            />
          ))}

          <FieldError mensaje={err("impuestos")} />
        </div>
      </div>
    </div>
  );
}
