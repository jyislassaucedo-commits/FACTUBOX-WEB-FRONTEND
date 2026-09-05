"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardBody, CardHeader, EmptyState, Note, Pill,
  Table, Td, Th, useToast,
} from "@/components/ui";
import { inputClass } from "@/components/ui/styles";
import {
  PERIODICIDADES_CORRIBLES, TIPOS_NOMINA, dias, etiquetaPeriodicidad, pesos, proponerPeriodo,
} from "@/lib/nominaShared";
import type { PeriodoNomina } from "@/lib/nomina";

/**
 * Las corridas de nómina del emisor.
 *
 * Cada renglón dice cuántos recibos lleva, cuántos van timbrados y cuántos
 * tronaron, porque esa es la pregunta del día de pago. "Quincena de agosto" no
 * le sirve a nadie; "faltan 3" sí.
 */
export function NominaSection({
  rfc,
  periodos,
  empleadosActivos,
}: {
  rfc: string;
  periodos: PeriodoNomina[];
  /** Para avisar antes de que alguien cree una corrida sin a quién pagarle. */
  empleadosActivos: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="space-y-4">
      {empleadosActivos === 0 && (
        <Note tone="warn" title="Todavía no hay a quién pagarle">
          Da de alta a tu plantilla en{" "}
          <Link href={`/emisores/${encodeURIComponent(rfc)}/empleados`} className="font-semibold underline">
            Empleados
          </Link>{" "}
          antes de correr una nómina.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Nómina"
          description="Cada corrida junta a quien le toca cobrar en ese periodo, le calcula su recibo y lo timbra."
          action={
            <Button variant="primary" onClick={() => setAbierto(true)}>
              Nueva corrida
            </Button>
          }
        />

        {periodos.length === 0 ? (
          <EmptyState
            title="Sin corridas todavía"
            description="Una corrida es la nómina de un periodo: la quincena, la semana, o un pago extraordinario como el aguinaldo."
            action={
              <Button variant="primary" onClick={() => setAbierto(true)}>
                Crear la primera
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Periodo</Th>
                <Th>Se paga</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Recibos</Th>
                <Th className="text-right">Neto</Th>
                <Th>Estado</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {periodos.map((p) => {
                const recibos = Number(p.Recibos ?? 0);
                const timbrados = Number(p.Timbrados ?? 0);
                const conError = Number(p.ConError ?? 0);
                const pendientes = recibos - timbrados - conError;
                return (
                  <tr key={p.Id} className="group transition hover:bg-surface-2">
                    <Td>
                      <span className="block text-[13.3px] font-semibold text-ink">
                        {p.FechaInicialPago} al {p.FechaFinalPago}
                      </span>
                      <span className="block text-[11.3px] text-ink-3">
                        {p.Descripcion || `${etiquetaPeriodicidad(p.Periodicidad)}, ${dias(p.DiasPagados)} días`}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-ink-2">{p.FechaPago}</Td>
                    <Td>
                      <Pill tone={p.TipoNomina === "O" ? "neutral" : "violet"}>
                        {p.TipoNomina === "O" ? "Ordinaria" : "Extraordinaria"}
                      </Pill>
                    </Td>
                    <Td className="text-right text-[12.5px] text-ink-2">
                      {recibos === 0 ? (
                        <span className="text-ink-3">sin calcular</span>
                      ) : (
                        <>
                          <span className="font-semibold text-ink">{timbrados}</span>
                          <span className="text-ink-3"> de {recibos}</span>
                        </>
                      )}
                    </Td>
                    <Td className="text-right font-mono text-[12.5px]">{pesos(p.TotalNeto)}</Td>
                    <Td>
                      {conError > 0 ? (
                        <Pill tone="danger" title={`${conError} recibos con error`}>
                          {conError} con error
                        </Pill>
                      ) : recibos > 0 && pendientes === 0 ? (
                        <Pill tone="ok">timbrada</Pill>
                      ) : p.Estado === "CERRADO" ? (
                        <Pill tone="warn">faltan {pendientes}</Pill>
                      ) : (
                        <Pill tone="neutral">borrador</Pill>
                      )}
                    </Td>
                    <Td>
                      <Link
                        href={`/emisores/${encodeURIComponent(rfc)}/nomina/${p.Id}`}
                        className="text-[12.5px] font-semibold text-brand hover:underline"
                      >
                        Abrir
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {abierto && (
        <NuevaCorridaModal
          rfc={rfc}
          onClose={() => setAbierto(false)}
          onCreada={(id) => {
            setAbierto(false);
            toast("Corrida creada");
            router.push(`/emisores/${encodeURIComponent(rfc)}/nomina/${id}`);
          }}
        />
      )}
    </div>
  );
}

/**
 * Alta de una corrida.
 *
 * Las fechas se proponen solas a partir de hoy — la quincena en curso, el mes
 * en curso — porque es lo que casi siempre se quiere y teclear cuatro fechas
 * para la nómina de cada quincena es donde se cuelan los dedazos. Se pueden
 * cambiar todas.
 */
function NuevaCorridaModal({
  rfc,
  onClose,
  onCreada,
}: {
  rfc: string;
  onClose: () => void;
  onCreada: (id: string) => void;
}) {
  const propuesta = proponerPeriodo("04");
  const [tipoNomina, setTipoNomina] = useState("O");
  const [periodicidad, setPeriodicidad] = useState("04");
  const [inicio, setInicio] = useState(propuesta.inicio);
  const [fin, setFin] = useState(propuesta.fin);
  const [pago, setPago] = useState(propuesta.pago);
  const [diasPagados, setDiasPagados] = useState(propuesta.dias);
  const [descripcion, setDescripcion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  /** Al cambiar la periodicidad se reproponen las fechas: una quincena y una
   *  semana no empiezan el mismo día. */
  function cambiarPeriodicidad(nueva: string) {
    setPeriodicidad(nueva);
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
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoNomina, periodicidad,
          fechaInicialPago: inicio, fechaFinalPago: fin, fechaPago: pago,
          diasPagados, descripcion: descripcion.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo crear la corrida");
        return;
      }
      onCreada(String(body.id));
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
            <h2 className="text-sm font-semibold text-ink">Nueva corrida</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Entran los empleados activos con esta periodicidad.
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
              <select className={inputClass} value={tipoNomina} onChange={(e) => setTipoNomina(e.target.value)}>
                {TIPOS_NOMINA.map((t) => (
                  <option key={t.clave} value={t.clave}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-ink-2">Periodicidad</label>
              <select className={inputClass} value={periodicidad} onChange={(e) => cambiarPeriodicidad(e.target.value)}>
                {PERIODICIDADES_CORRIBLES.map((p) => (
                  <option key={p.clave} value={p.clave}>{p.label}</option>
                ))}
              </select>
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
              {guardando ? "Creando…" : "Crear corrida"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
