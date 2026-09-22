"use client";

import { useState } from "react";
import { Button, Card, CardBody, CardHeader, FieldError, Input, Note, Select } from "@/components/ui";
import { inputClass } from "@/components/ui/styles";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import {
  TIPOS_RELACION_NOMINA,
  mensajeDe,
  nuevaDeduccion,
  nuevaIncapacidad,
  nuevaPercepcion,
  nuevaSubContratacion,
  type NominaManualForm,
  type ProblemaManual,
} from "@/lib/nominaManualShared";
import { BotonQuitar, Campo, InputDinero, InputEntero, SelectCatalogo } from "./campos";

/**
 * Lo que no es un renglón del recibo pero el complemento también lleva:
 * las incapacidades (con sus días y tipo, aunque no cueste nada), la
 * subcontratación y los CFDI que este sustituye o corrige.
 */
export function PasoExtras({
  form,
  set,
  problemas,
  mostrarErrores,
}: {
  form: NominaManualForm;
  set: (cambio: Partial<NominaManualForm>) => void;
  problemas: ProblemaManual[];
  mostrarErrores: boolean;
}) {
  const { catalogos } = useCatalogosNomina();
  const err = (campo: string) => (mostrarErrores ? mensajeDe(problemas, campo) : null);
  const [uuidNuevo, setUuidNuevo] = useState("");

  function setIncapacidad(i: number, cambio: Partial<NominaManualForm["incapacidades"][number]>) {
    set({ incapacidades: form.incapacidades.map((r, j) => (j === i ? { ...r, ...cambio } : r)) });
  }
  function setSub(i: number, cambio: Partial<NominaManualForm["subcontratacion"][number]>) {
    set({ subcontratacion: form.subcontratacion.map((r, j) => (j === i ? { ...r, ...cambio } : r)) });
  }

  /** Como en el escritorio: la incapacidad puede además reflejarse como
   *  renglón (percepción 014 si la paga el IMSS, deducción 006 si se descuenta). */
  function agregarComoRenglon(i: number, grupo: "PERCEPCION" | "DEDUCCION") {
    const inc = form.incapacidades[i];
    const importe = inc.importeMonetario || "0";
    if (grupo === "PERCEPCION") {
      const fila = nuevaPercepcion("014");
      fila.concepto = "Subsidios por incapacidad";
      fila.importeGravado = "0";
      fila.importeExento = importe;
      set({ percepciones: [...form.percepciones, fila] });
    } else {
      const fila = nuevaDeduccion("006");
      fila.concepto = "Descuento por incapacidad";
      fila.importe = importe;
      set({ deducciones: [...form.deducciones, fila] });
    }
  }

  function agregarUuid() {
    const u = uuidNuevo.trim().toUpperCase();
    if (!u) return;
    const rel = form.relacionados ?? { tipoRelacion: "04", uuids: [] };
    set({ relacionados: { ...rel, uuids: [...rel.uuids, u] } });
    setUuidNuevo("");
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Incapacidades"
          description="Días y tipo, aunque el importe sea cero: el SAT los cruza con el IMSS."
          action={
            <Button variant="secondary" size="sm" onClick={() => set({ incapacidades: [...form.incapacidades, nuevaIncapacidad()] })}>
              Agregar
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {form.incapacidades.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-ink-3">
              Sin incapacidades en este periodo.
            </p>
          )}
          {form.incapacidades.map((r, i) => {
            const ref = `incapacidades[${i}]`;
            return (
              <div key={r.id} className="rounded-xl border border-line-2 p-3">
                <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
                  <Campo label="Días" error={err(`${ref}.dias`)}>
                    <InputEntero min="1" value={r.dias} onChange={(e) => setIncapacidad(i, { dias: e.target.value })} />
                  </Campo>
                  <Campo label="Tipo" error={err(`${ref}.tipoIncapacidad`)}>
                    <SelectCatalogo lista={catalogos.tiposIncapacidades} value={r.tipoIncapacidad} onChange={(t) => setIncapacidad(i, { tipoIncapacidad: t })} />
                  </Campo>
                  <Campo label="Importe" error={err(`${ref}.importeMonetario`)} hint="Lo que reconoció el IMSS, si se sabe.">
                    <InputDinero value={r.importeMonetario} onChange={(e) => setIncapacidad(i, { importeMonetario: e.target.value })} />
                  </Campo>
                  <div className="flex items-end pb-1.5">
                    <BotonQuitar onClick={() => set({ incapacidades: form.incapacidades.filter((_, j) => j !== i) })} />
                  </div>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink-3">
                  <span>Reflejarla también como renglón:</span>
                  <button type="button" onClick={() => agregarComoRenglon(i, "PERCEPCION")} className="font-semibold text-brand hover:underline">
                    percepción 014 (la paga el IMSS)
                  </button>
                  <span>·</span>
                  <button type="button" onClick={() => agregarComoRenglon(i, "DEDUCCION")} className="font-semibold text-brand hover:underline">
                    deducción 006 (se descuenta)
                  </button>
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Subcontratación"
          description="Si el empleado prestó servicios para otro patrón: el RFC y qué porcentaje de su tiempo."
          action={
            <Button variant="secondary" size="sm" onClick={() => set({ subcontratacion: [...form.subcontratacion, nuevaSubContratacion()] })}>
              Agregar
            </Button>
          }
        />
        <CardBody className="space-y-3">
          <FieldError mensaje={err("subcontratacion")} />
          {form.subcontratacion.length === 0 && (
            <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-[12.5px] text-ink-3">
              Sin subcontratación.
            </p>
          )}
          {form.subcontratacion.map((r, i) => {
            const ref = `subcontratacion[${i}]`;
            return (
              <div key={r.id} className="grid gap-3 rounded-xl border border-line-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
                <Campo label="RFC donde labora" error={err(`${ref}.rfcLabora`)}>
                  <Input value={r.rfcLabora} maxLength={13} className="font-mono uppercase" onChange={(e) => setSub(i, { rfcLabora: e.target.value.toUpperCase() })} />
                </Campo>
                <Campo label="% del tiempo" error={err(`${ref}.porcentajeTiempo`)}>
                  <Input type="number" step="0.001" min="0" max="100" value={r.porcentajeTiempo} onChange={(e) => setSub(i, { porcentajeTiempo: e.target.value })} />
                </Campo>
                <div className="flex items-end pb-1.5">
                  <BotonQuitar onClick={() => set({ subcontratacion: form.subcontratacion.filter((_, j) => j !== i) })} />
                </div>
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="CFDI relacionados"
          description="Cuando este recibo sustituye a uno cancelado (relación 04) o corrige otro."
          action={
            form.relacionados ? (
              <Button variant="ghost" size="sm" onClick={() => set({ relacionados: null })}>
                Quitar relación
              </Button>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => set({ relacionados: { tipoRelacion: "04", uuids: [] } })}>
                Relacionar
              </Button>
            )
          }
        />
        {form.relacionados && (
          <CardBody className="space-y-3">
            <Campo label="Tipo de relación" error={err("relacionados.tipoRelacion")}>
              <Select
                value={form.relacionados.tipoRelacion}
                onChange={(e) => set({ relacionados: { ...form.relacionados!, tipoRelacion: e.target.value } })}
              >
                {TIPOS_RELACION_NOMINA.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
            </Campo>
            <div>
              <span className="mb-1.5 block text-xs font-semibold text-ink-2">UUIDs relacionados</span>
              <FieldError mensaje={err("relacionados.uuids")} />
              <ul className="space-y-1.5">
                {form.relacionados.uuids.map((u, j) => (
                  <li key={u + j} className="flex items-center justify-between gap-2 rounded-lg border border-line-2 px-3 py-1.5">
                    <span className="min-w-0">
                      <span className="block truncate font-mono text-[12.5px] text-ink">{u}</span>
                      <FieldError mensaje={err(`relacionados.uuids[${j}]`)} />
                    </span>
                    <BotonQuitar onClick={() => set({ relacionados: { ...form.relacionados!, uuids: form.relacionados!.uuids.filter((_, k) => k !== j) } })} />
                  </li>
                ))}
              </ul>
              <div className="mt-2 flex gap-2">
                <input
                  className={inputClass + " font-mono uppercase"}
                  placeholder="5FB2822E-396D-4BEA-9A4A-D0A2E6F2A5F4"
                  value={uuidNuevo}
                  onChange={(e) => setUuidNuevo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      agregarUuid();
                    }
                  }}
                />
                <Button variant="secondary" onClick={agregarUuid} disabled={!uuidNuevo.trim()}>
                  Agregar
                </Button>
              </div>
            </div>
          </CardBody>
        )}
      </Card>

      <Card>
        <CardHeader title="Nota interna" description="Para ti: no va al XML ni al PDF. Se guarda con la prenómina." />
        <CardBody>
          <textarea
            className={inputClass + " min-h-[72px]"}
            maxLength={500}
            value={form.observaciones}
            onChange={(e) => set({ observaciones: e.target.value })}
            placeholder="Por qué se hizo este recibo, qué lo distingue…"
          />
          {form.periodo.tipoNomina === "E" && form.incapacidades.length > 0 && (
            <Note tone="info">Una extraordinaria con incapacidades es raro; revisa que el tipo de nómina sea el correcto.</Note>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
