"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardBody, CardHeader, EmptyState, Note, Pill,
  Table, Td, Th, useToast,
} from "@/components/ui";
import { dias, etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import type { PeriodoNomina, ReciboNomina } from "@/lib/nomina";
import type { Serie } from "@/lib/series";

type Omitido = { Nombre: string; Motivo: string };
type AvisoCalculo = { Nombre: string; Aviso: string };

/** Lo que va pasando durante el timbrado, para pintarlo mientras corre. */
type Avance = {
  total: number;
  hechos: number;
  actual: string;
  resultados: { nombre: string; ok: boolean; uuid?: string; error?: string; folio: string }[];
};

export function CorridaSection({
  rfc,
  emisorToken,
  periodo,
  recibos,
  series,
}: {
  rfc: string;
  emisorToken: string;
  periodo: PeriodoNomina;
  recibos: ReciboNomina[];
  /** Solo las de tipo N: un recibo de nómina no puede llevar serie de ingreso. */
  series: Serie[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [serie, setSerie] = useState(series[0]?.Nombre ?? "");
  const [calculando, setCalculando] = useState(false);
  const [omitidos, setOmitidos] = useState<Omitido[]>([]);
  const [avisos, setAvisos] = useState<AvisoCalculo[]>([]);
  const [avance, setAvance] = useState<Avance | null>(null);

  const pendientes = recibos.filter((r) => r.Estado !== "TIMBRADO");
  const timbrados = recibos.filter((r) => r.Estado === "TIMBRADO");
  const conError = recibos.filter((r) => r.Estado === "ERROR");
  const netoTotal = recibos.reduce((a, r) => a + (parseFloat(r.Neto) || 0), 0);

  async function calcular() {
    setCalculando(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}/calcular`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo correr la nómina", "danger");
        return;
      }
      setOmitidos(body.omitidos ?? []);
      setAvisos(body.avisos ?? []);
      if (body.nota) toast(body.nota, "danger");
      else toast(`${(body.calculados ?? []).length} recibos calculados`);
      router.refresh();
    } finally {
      setCalculando(false);
    }
  }

  /**
   * Timbra uno por uno y va pintando el avance.
   *
   * De uno en uno y no todos de golpe: se ve por quién va, un rechazo no
   * detiene a los demás, y al final queda claro a quién hay que volver. Cada
   * recibo consume un timbre, así que no hay vuelta atrás por los que ya
   * salieron.
   */
  async function timbrar() {
    if (!serie) {
      toast("Elige la serie con la que se van a timbrar", "danger");
      return;
    }
    const cola = pendientes;
    setAvance({ total: cola.length, hechos: 0, actual: cola[0]?.Nombre ?? "", resultados: [] });

    for (let i = 0; i < cola.length; i++) {
      const r = cola[i];
      setAvance((a) => (a ? { ...a, actual: r.Nombre } : a));
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}/timbrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEmpleado: r.IdEmpleado, emisorToken, serie }),
      }).then((x) => x.json());

      setAvance((a) =>
        a
          ? {
              ...a,
              hechos: i + 1,
              resultados: [
                ...a.resultados,
                { nombre: r.Nombre, ok: res.ok === true, uuid: res.uuid, error: res.error, folio: res.folio ?? "" },
              ],
            }
          : a
      );
    }

    router.refresh();
  }

  const corriendo = avance !== null && avance.hechos < avance.total;

  return (
    <div className="space-y-4">
      <nav className="text-[12.5px] text-ink-3">
        <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina`} className="hover:text-brand">
          Nómina
        </Link>
        <span aria-hidden> / </span>
        <span className="font-medium text-ink-2">
          {periodo.FechaInicialPago} al {periodo.FechaFinalPago}
        </span>
      </nav>

      <Card>
        <CardHeader
          title={periodo.Descripcion || `${etiquetaPeriodicidad(periodo.Periodicidad)} del ${periodo.FechaInicialPago} al ${periodo.FechaFinalPago}`}
          description={`Se paga el ${periodo.FechaPago} · ${dias(periodo.DiasPagados)} días · ${periodo.TipoNomina === "O" ? "ordinaria" : "extraordinaria"}`}
          action={
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={calcular} disabled={calculando || corriendo}>
                {calculando ? "Calculando…" : recibos.length ? "Recalcular" : "Correr nómina"}
              </Button>
              {pendientes.length > 0 && (
                <Button variant="primary" onClick={timbrar} disabled={corriendo || calculando}>
                  {corriendo ? "Timbrando…" : `Timbrar ${pendientes.length}`}
                </Button>
              )}
            </div>
          }
        />

        <CardBody className="grid grid-cols-2 gap-3 border-b border-line-2 sm:grid-cols-4">
          {[
            { label: "Recibos", valor: String(recibos.length) },
            { label: "Timbrados", valor: String(timbrados.length) },
            { label: "Con error", valor: String(conError.length) },
            { label: "Neto total", valor: pesos(netoTotal) },
          ].map((k) => (
            <div key={k.label}>
              <p className="text-[11px] uppercase tracking-wide text-ink-3">{k.label}</p>
              <p className="mt-0.5 text-[15px] font-bold text-ink">{k.valor}</p>
            </div>
          ))}
        </CardBody>

        {pendientes.length > 0 && (
          <CardBody className="flex flex-wrap items-end gap-3 border-b border-line-2">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-ink-2">Serie del recibo</label>
              <select
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                disabled={corriendo}
              >
                {series.length === 0 && <option value="">Sin series de tipo Nómina</option>}
                {series.map((s) => (
                  <option key={s.Nombre} value={s.Nombre}>{s.Nombre}</option>
                ))}
              </select>
            </div>
            {series.length === 0 && (
              <p className="text-[12px] text-warn">
                Crea una serie de tipo Nómina en{" "}
                <Link href={`/emisores/${encodeURIComponent(rfc)}/series`} className="font-semibold underline">
                  Series y folios
                </Link>
                .
              </p>
            )}
          </CardBody>
        )}
      </Card>

      {avance && (
        <Card>
          <CardHeader
            title={corriendo ? `Timbrando ${avance.hechos + 1} de ${avance.total}` : "Timbrado terminado"}
            description={corriendo ? `Va en ${avance.actual}. Cada recibo consume un timbre.` : undefined}
          />
          <CardBody className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
              <div
                className="h-full bg-[var(--brand)] transition-all"
                style={{ width: `${(avance.hechos / Math.max(1, avance.total)) * 100}%` }}
              />
            </div>
            {avance.resultados.map((r, i) => (
              <p key={r.nombre + i} className="text-[12.5px]">
                {r.ok ? (
                  <>
                    <span className="text-ok">✓</span> {r.nombre}{" "}
                    <span className="font-mono text-[11.5px] text-ink-3">{r.uuid}</span>
                  </>
                ) : (
                  <>
                    <span className="text-danger">✕</span> {r.nombre}{" "}
                    <span className="text-danger">{r.error}</span>
                  </>
                )}
              </p>
            ))}
          </CardBody>
        </Card>
      )}

      {omitidos.length > 0 && (
        <Note tone="warn" title={`${omitidos.length} empleados quedaron fuera de la corrida`}>
          <ul className="mt-1 space-y-1">
            {omitidos.map((o, i) => (
              <li key={o.Nombre + i}>· <span className="font-medium">{o.Nombre}</span>: {o.Motivo}</li>
            ))}
          </ul>
        </Note>
      )}

      {avisos.length > 0 && (
        <Note tone="info" title={`${avisos.length} detalles que conviene revisar`}>
          <ul className="mt-1 space-y-1">
            {avisos.map((a, i) => (
              <li key={a.Nombre + i}>· <span className="font-medium">{a.Nombre}</span>: {a.Aviso}</li>
            ))}
          </ul>
        </Note>
      )}

      <Card>
        <CardHeader title="Recibos" description="Lo que le toca cobrar a cada quien en este periodo." />
        {recibos.length === 0 ? (
          <EmptyState
            title="Todavía no se ha corrido"
            description="Al correrla entran los empleados activos con esta periodicidad, y a cada uno se le calcula su recibo."
            action={
              <Button variant="primary" onClick={calcular} disabled={calculando}>
                {calculando ? "Calculando…" : "Correr nómina"}
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Empleado</Th>
                <Th className="text-right">Días</Th>
                <Th className="text-right">Percepciones</Th>
                <Th className="text-right">ISR</Th>
                <Th className="text-right">Subsidio</Th>
                <Th className="text-right">Neto</Th>
                <Th>Estado</Th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((r) => (
                <tr key={r.Id} className="transition hover:bg-surface-2">
                  <Td>
                    <span className="block text-[13.3px] font-semibold text-ink">{r.Nombre}</span>
                    <span className="block font-mono text-[11.3px] text-ink-3">
                      {r.Rfc}{r.NumEmpleado ? ` · #${r.NumEmpleado}` : ""}
                    </span>
                  </Td>
                  <Td className="text-right text-[12.5px]">{dias(r.DiasPagados)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">{pesos(r.TotalPercepciones)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">{pesos(r.IsrRetenido)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">
                    {parseFloat(r.SubsidioEntregado) > 0 ? (
                      <span className="text-ok" title="Se le entrega: su subsidio superó al ISR">
                        {pesos(r.SubsidioEntregado)}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="text-right font-mono text-[12.5px] font-semibold">{pesos(r.Neto)}</Td>
                  <Td>
                    {r.Estado === "TIMBRADO" ? (
                      <Pill tone="ok">timbrado</Pill>
                    ) : r.Estado === "ERROR" ? (
                      <Pill tone="danger" title={r.Error ?? undefined}>error</Pill>
                    ) : (
                      <Pill tone="neutral">por timbrar</Pill>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}

        {conError.length > 0 && (
          <CardBody className="border-t border-line-2">
            <Note tone="danger" title={`${conError.length} recibos no se timbraron`}>
              <ul className="mt-1 space-y-1">
                {conError.map((r) => (
                  <li key={r.Id}>· <span className="font-medium">{r.Nombre}</span>: {r.Error}</li>
                ))}
              </ul>
              <p className="mt-1.5 opacity-80">
                Corrige lo que falta y vuelve a timbrar: solo se reintentan los que no salieron, los
                timbrados no se tocan.
              </p>
            </Note>
          </CardBody>
        )}
      </Card>
    </div>
  );
}
