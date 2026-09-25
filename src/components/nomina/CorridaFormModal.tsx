"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/styles";
import {
  PERIODICIDADES_CORRIBLES, PERIODICIDAD_EXTRAORDINARIA, TIPOS_NOMINA, proponerPeriodo,
} from "@/lib/nominaShared";
import type { NombreCorrida, PeriodoNomina } from "@/lib/nomina";

/**
 * Los datos de una corrida: nombre, tipo, periodicidad y fechas.
 *
 * Las fechas se proponen solas a partir de hoy — la quincena en curso, el mes
 * en curso — porque es lo que casi siempre se quiere y teclear cuatro fechas
 * para la nómina de cada quincena es donde se cuelan los dedazos. Se pueden
 * cambiar todas.
 *
 * El estado vive en `useCorridaForm` para que lo compartan el asistente de
 * nueva corrida (un paso para el nombre, otro para el periodo) y el modal con
 * el que se edita una corrida ya creada.
 */
export function useCorridaForm(rfc: string, periodo?: PeriodoNomina) {
  const editando = periodo !== undefined;
  const propuesta = proponerPeriodo(periodo?.Periodicidad ?? "04");
  const [tipoNomina, setTipoNominaCrudo] = useState(periodo?.TipoNomina ?? "O");
  const [periodicidad, setPeriodicidad] = useState(periodo?.Periodicidad ?? "04");
  const [inicio, setInicio] = useState(periodo?.FechaInicialPago ?? propuesta.inicio);
  const [fin, setFin] = useState(periodo?.FechaFinalPago ?? propuesta.fin);
  const [pago, setPago] = useState(periodo?.FechaPago ?? propuesta.pago);
  const [diasPagados, setDiasPagados] = useState(
    periodo ? String(parseFloat(periodo.DiasPagados)) : propuesta.dias
  );
  const [nombre, setNombre] = useState(periodo?.Nombre ?? "");
  const [descripcion, setDescripcion] = useState(periodo?.Descripcion ?? "");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /** Al cambiar la periodicidad se reproponen las fechas: una quincena y una
   *  semana no empiezan el mismo día. Al editar no se tocan: quien abrió a
   *  corregir un dedazo en la fecha de pago no espera que le muevan el resto. */
  function cambiarPeriodicidad(nueva: string) {
    setPeriodicidad(nueva);
    if (editando) return;
    const p = proponerPeriodo(nueva);
    setInicio(p.inicio);
    setFin(p.fin);
    setPago(p.pago);
    setDiasPagados(p.dias);
  }

  function setTipoNomina(t: string) {
    setTipoNominaCrudo(t);
    // El SAT exige periodicidad 99 en una extraordinaria: el pago no
    // corresponde a un periodo. Se pone sola porque dejar que alguien elija
    // otra es dejar que se lleve un rechazo.
    if (t === "E") setPeriodicidad(PERIODICIDAD_EXTRAORDINARIA);
  }

  /** Lo que falta para poder guardar, en palabras. */
  const faltan: string[] = [];
  if (!inicio) faltan.push("la fecha inicial");
  if (!fin) faltan.push("la fecha final");
  if (!pago) faltan.push("la fecha de pago");
  if (!(Number(diasPagados) > 0)) faltan.push("los días pagados");

  /** Crea o guarda. Devuelve el id de la corrida, o null si no se pudo. */
  async function guardar(): Promise<string | null> {
    setError(null);
    if (faltan.length > 0) {
      setError(`Falta ${faltan.join(", ")}.`);
      return null;
    }
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/empresas/${encodeURIComponent(rfc)}/nomina${editando ? `/${periodo.Id}` : ""}`,
        {
          method: editando ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tipoNomina, periodicidad,
            fechaInicialPago: inicio, fechaFinalPago: fin, fechaPago: pago,
            diasPagados,
            nombre: nombre.trim() || undefined,
            descripcion: descripcion.trim() || undefined,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? (editando ? "No se pudo guardar" : "No se pudo crear la corrida"));
        return null;
      }
      return String(body.id ?? periodo?.Id ?? "");
    } catch {
      setError("No se pudo conectar con el servidor");
      return null;
    } finally {
      setGuardando(false);
    }
  }

  return {
    editando, tipoNomina, setTipoNomina, periodicidad, cambiarPeriodicidad,
    inicio, setInicio, fin, setFin, pago, setPago, diasPagados, setDiasPagados,
    nombre, setNombre, descripcion, setDescripcion, error, guardando, faltan, guardar,
  };
}

export type CorridaForm = ReturnType<typeof useCorridaForm>;

/** El nombre de la corrida, con los que la empresa ya usa a un clic. */
export function CamposNombre({ f, nombres }: { f: CorridaForm; nombres: NombreCorrida[] }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-2">
        Nombre de la corrida (opcional)
      </label>
      <input
        className={inputClass}
        value={f.nombre}
        list="nombres-corrida"
        maxLength={80}
        placeholder="Ej. Quincenal oficina, Empleados especiales, Mensuales"
        onChange={(e) => f.setNombre(e.target.value)}
      />
      <datalist id="nombres-corrida">
        {nombres.map((n) => (
          <option key={n.Nombre} value={n.Nombre} />
        ))}
      </datalist>
      {nombres.length > 0 && (
        // Los que ya usa, de un clic. El datalist sólo se abre si uno
        // sabe que está ahí; estos se ven, y son lo que evita que la
        // misma corrida se llame distinto cada quincena.
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {nombres.map((n) => (
            <button
              key={n.Nombre}
              type="button"
              onClick={() => f.setNombre(n.Nombre)}
              className={`rounded-full border px-2.5 py-1 text-[11.5px] transition ${
                f.nombre === n.Nombre
                  ? "border-brand bg-brand/10 font-semibold text-brand"
                  : "border-line text-ink-2 hover:bg-surface-2"
              }`}
            >
              {n.Nombre}
            </button>
          ))}
        </div>
      )}
      <p className="mt-1 text-[11px] text-ink-3">
        Para distinguirla de las demás cuando corres varias nóminas a la vez. Se conserva al
        repetirla; la descripción del periodo no.
      </p>
    </div>
  );
}

/** Tipo, periodicidad, fechas, días y descripción. */
export function CamposPeriodo({ f }: { f: CorridaForm }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-2">Tipo</label>
          <select className={inputClass} value={f.tipoNomina} onChange={(e) => f.setTipoNomina(e.target.value)}>
            {TIPOS_NOMINA.map((t) => (
              <option key={t.clave} value={t.clave}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-2">Periodicidad</label>
          <select className={inputClass} value={f.periodicidad} disabled={f.tipoNomina === "E"}
            onChange={(e) => f.cambiarPeriodicidad(e.target.value)}>
            {PERIODICIDADES_CORRIBLES.map((p) => (
              <option key={p.clave} value={p.clave}>{p.label}</option>
            ))}
          </select>
          {f.tipoNomina === "E" && (
            <p className="mt-1 text-[11px] text-ink-3">
              Fija en una extraordinaria: el pago no corresponde a un periodo.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-2">Del</label>
          <input type="date" className={inputClass} value={f.inicio} required onChange={(e) => f.setInicio(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-2">Al</label>
          <input type="date" className={inputClass} value={f.fin} required onChange={(e) => f.setFin(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-ink-2">Días pagados</label>
          <input type="number" step="0.001" min="0.001" className={inputClass} value={f.diasPagados} required onChange={(e) => f.setDiasPagados(e.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-2">Fecha de pago</label>
        <input type="date" className={inputClass} value={f.pago} required onChange={(e) => f.setPago(e.target.value)} />
        <p className="mt-1 text-[11px] text-ink-3">
          Decide qué tarifa y qué UMA se aplican. Una quincena que cierra el 31 de enero y se
          paga el 2 de febrero ya usa la UMA nueva.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-ink-2">
          Descripción de este periodo (opcional)
        </label>
        <input className={inputClass} value={f.descripcion} placeholder="Ej. Primera quincena de agosto" onChange={(e) => f.setDescripcion(e.target.value)} />
      </div>
    </div>
  );
}

/** Editar una corrida ya creada. Crear una nueva es el asistente de /facturas/nomina/nueva. */
export function CorridaFormModal({
  rfc,
  periodo,
  nombres = [],
  onClose,
  onCreada,
}: {
  rfc: string;
  periodo: PeriodoNomina;
  /** Los que la empresa ya usa, para reusarlos en vez de reescribirlos. */
  nombres?: NombreCorrida[];
  onClose: () => void;
  onCreada: (id: string) => void;
}) {
  const f = useCorridaForm(rfc, periodo);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    const id = await f.guardar();
    if (id !== null) onCreada(id);
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 max-h-[90vh] w-full max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">Editar corrida</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Al guardar hay que volver a correr la nómina para que los recibos usen las fechas nuevas.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-3 hover:text-ink">
            Cerrar
          </button>
        </div>

        <form onSubmit={enviar} className="space-y-3">
          <CamposNombre f={f} nombres={nombres} />
          <CamposPeriodo f={f} />

          {f.error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{f.error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2">
              Cancelar
            </button>
            <button type="submit" disabled={f.guardando} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50">
              {f.guardando ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
