"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/styles";
import {
  PERIODICIDADES_CORRIBLES, PERIODICIDAD_EXTRAORDINARIA, TIPOS_NOMINA, proponerPeriodo,
} from "@/lib/nominaShared";
import type { PeriodoNomina } from "@/lib/nomina";

/**
 * Alta de una corrida.
 *
 * Las fechas se proponen solas a partir de hoy — la quincena en curso, el mes
 * en curso — porque es lo que casi siempre se quiere y teclear cuatro fechas
 * para la nómina de cada quincena es donde se cuelan los dedazos. Se pueden
 * cambiar todas.
 */
export function CorridaFormModal({
  rfc,
  periodo,
  onClose,
  onCreada,
}: {
  rfc: string;
  /** Con periodo edita; sin él, crea. */
  periodo?: PeriodoNomina;
  onClose: () => void;
  onCreada: (id: string) => void;
}) {
  const editando = periodo !== undefined;
  const propuesta = proponerPeriodo(periodo?.Periodicidad ?? "04");
  const [tipoNomina, setTipoNomina] = useState(periodo?.TipoNomina ?? "O");
  const [periodicidad, setPeriodicidad] = useState(periodo?.Periodicidad ?? "04");
  const [inicio, setInicio] = useState(periodo?.FechaInicialPago ?? propuesta.inicio);
  const [fin, setFin] = useState(periodo?.FechaFinalPago ?? propuesta.fin);
  const [pago, setPago] = useState(periodo?.FechaPago ?? propuesta.pago);
  const [diasPagados, setDiasPagados] = useState(
    periodo ? String(parseFloat(periodo.DiasPagados)) : propuesta.dias
  );
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

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
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
          diasPagados, descripcion: descripcion.trim() || undefined,
        }),
      }
      );
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? (editando ? "No se pudo guardar" : "No se pudo crear la corrida"));
        return;
      }
      onCreada(String(body.id ?? periodo?.Id ?? ""));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-xl bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {editando ? "Editar corrida" : "Nueva corrida"}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {editando
                ? "Al guardar hay que volver a correr la nómina para que los recibos usen las fechas nuevas."
                : tipoNomina === "E"
                  ? "No paga el sueldo del periodo: solo lo que captures, como el aguinaldo."
                  : "Entran los empleados activos con esta periodicidad."}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-3 hover:text-ink">
            Cerrar
          </button>
        </div>

        <form onSubmit={guardar} className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Tipo</label>
              <select className={inputClass} value={tipoNomina}
                onChange={(e) => {
                  setTipoNomina(e.target.value);
                  // El SAT exige periodicidad 99 en una extraordinaria: el pago
                  // no corresponde a un periodo. Se pone sola porque dejar que
                  // alguien elija otra es dejar que se lleve un rechazo.
                  if (e.target.value === "E") setPeriodicidad(PERIODICIDAD_EXTRAORDINARIA);
                }}>
                {TIPOS_NOMINA.map((t) => (
                  <option key={t.clave} value={t.clave}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Periodicidad</label>
              <select className={inputClass} value={periodicidad} disabled={tipoNomina === "E"}
                onChange={(e) => cambiarPeriodicidad(e.target.value)}>
                {PERIODICIDADES_CORRIBLES.map((p) => (
                  <option key={p.clave} value={p.clave}>{p.label}</option>
                ))}
              </select>
              {tipoNomina === "E" && (
                <p className="mt-1 text-[11px] text-ink-3">
                  Fija en una extraordinaria: el pago no corresponde a un periodo.
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Del</label>
              <input type="date" className={inputClass} value={inicio} required onChange={(e) => setInicio(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Al</label>
              <input type="date" className={inputClass} value={fin} required onChange={(e) => setFin(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Días pagados</label>
              <input type="number" step="0.001" min="0.001" className={inputClass} value={diasPagados} required onChange={(e) => setDiasPagados(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Fecha de pago</label>
            <input type="date" className={inputClass} value={pago} required onChange={(e) => setPago(e.target.value)} />
            <p className="mt-1 text-[11px] text-ink-3">
              Decide qué tarifa y qué UMA se aplican. Una quincena que cierra el 31 de enero y se
              paga el 2 de febrero ya usa la UMA nueva.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-ink-2">Descripción (opcional)</label>
            <input className={inputClass} value={descripcion} placeholder="Ej. Primera quincena de agosto" onChange={(e) => setDescripcion(e.target.value)} />
          </div>

          {error && <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50">
              {guardando ? "Guardando…" : editando ? "Guardar cambios" : "Crear corrida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
