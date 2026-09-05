"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardBody, CardHeader, EmptyState, Note, Pill,
  Table, Td, Th, useToast,
} from "@/components/ui";
import { dias, etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import { CorridaFormModal } from "./CorridaFormModal";
import { RepetirCorridaModal } from "./RepetirCorridaModal";
import type { NombreCorrida, PeriodoNomina } from "@/lib/nomina";

/**
 * Qué corridas se están viendo.
 *
 * `null` es "las que nadie nombró", que no es lo mismo que "todas" ni un
 * nombre vacío. Un centinela de cadena chocaría el día que alguien bautice su
 * corrida justo así.
 */
type Filtro = { tipo: "todas" } | { tipo: "sin-nombre" } | { tipo: "nombre"; nombre: string };

function coincide(p: PeriodoNomina, f: Filtro) {
  if (f.tipo === "todas") return true;
  if (f.tipo === "sin-nombre") return !p.Nombre;
  return p.Nombre === f.nombre;
}

function chipClass(activo: boolean) {
  return `rounded-full border px-3 py-1 text-[12px] transition ${
    activo
      ? "border-brand bg-brand/10 font-semibold text-brand"
      : "border-line text-ink-2 hover:bg-surface-2"
  }`;
}

/**
 * Las corridas de nómina del emisor.
 *
 * Cada renglón dice cuántos recibos lleva, cuántos van timbrados y cuántos
 * tronaron, porque esa es la pregunta del día de pago. "Quincena de agosto" no
 * le sirve a nadie; "faltan 3" sí.
 *
 * Una empresa suele correr varias nóminas en paralelo, así que cada corrida
 * lleva nombre y la lista se puede filtrar por él: con la quincena de oficina y
 * la de los especiales en las mismas fechas, sin nombre no hay forma de saber
 * cuál es cuál sin abrirlas.
 */
export function NominaSection({
  rfc,
  periodos,
  nombres = [],
  empleadosActivos,
}: {
  rfc: string;
  periodos: PeriodoNomina[];
  /** Los nombres que la empresa ya usa, para reusarlos al crear la siguiente. */
  nombres?: NombreCorrida[];
  /** Para avisar antes de que alguien cree una corrida sin a quién pagarle. */
  empleadosActivos: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [abierto, setAbierto] = useState(false);
  const [repetir, setRepetir] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>({ tipo: "todas" });

  /**
   * La última corrida repetible de cada nombre.
   *
   * Una por nombre y no una sola: quien corre la quincena de oficina, la semana
   * de los de raya y un puñado de especiales tiene tres nóminas que repetir, no
   * una. Con un solo atajo, dos de las tres se arman a mano cada vez.
   *
   * Ordinarias nada más: un aguinaldo no tiene periodo siguiente. Y con
   * recibos, porque sin ellos no hay a quién repetirle.
   */
  const repetibles: PeriodoNomina[] = [];
  const vistos = new Set<string | null>();
  for (const p of periodos) {
    if (p.TipoNomina === "E" || Number(p.Recibos ?? 0) === 0) continue;
    const clave = p.Nombre ?? null;
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    repetibles.push(p);
  }

  const visibles = periodos.filter((p) => coincide(p, filtro));
  const hayNombres = nombres.length > 0;
  const haySinNombre = periodos.some((p) => !p.Nombre);

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

      {repetibles.length > 0 && (
        <div className="rounded-[13px] border border-brand/25 bg-brand/[0.06] px-4 py-3.5">
          <p className="text-[13.3px] font-semibold text-ink">
            {repetibles.length === 1 ? "¿La misma nómina otra vez?" : "¿Las mismas nóminas otra vez?"}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">
            Repetir una te deja el periodo siguiente listo: la misma gente y ya calculado.
          </p>

          <div className="mt-2.5 space-y-1.5">
            {repetibles.map((p) => (
              <div
                key={p.Id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[10px] bg-surface/60 px-3 py-2"
              >
                <div className="min-w-0 text-[12.5px] text-ink-2">
                  <span className="font-semibold text-ink">{p.Nombre || "Sin nombre"}</span>
                  <span className="text-ink-3">
                    {" "}
                    · última del {p.FechaInicialPago} al {p.FechaFinalPago}, {p.Recibos}{" "}
                    {Number(p.Recibos) === 1 ? "recibo" : "recibos"}
                  </span>
                </div>
                <Button variant="primary" size="sm" onClick={() => setRepetir(String(p.Id))}>
                  Repetir
                </Button>
              </div>
            ))}
          </div>
        </div>
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

        {/* El filtro sólo aparece cuando hay algo que separar. Con una sola
            corrida es un control que no hace nada y estorba. */}
        {hayNombres && (
          <CardBody className="flex flex-wrap items-center gap-1.5 border-b border-line-2">
            <button
              type="button"
              onClick={() => setFiltro({ tipo: "todas" })}
              className={chipClass(filtro.tipo === "todas")}
            >
              Todas ({periodos.length})
            </button>
            {nombres.map((n) => (
              <button
                key={n.Nombre}
                type="button"
                onClick={() => setFiltro({ tipo: "nombre", nombre: n.Nombre })}
                className={chipClass(filtro.tipo === "nombre" && filtro.nombre === n.Nombre)}
              >
                {n.Nombre} ({n.Veces})
              </button>
            ))}
            {haySinNombre && (
              <button
                type="button"
                onClick={() => setFiltro({ tipo: "sin-nombre" })}
                className={chipClass(filtro.tipo === "sin-nombre")}
              >
                Sin nombre ({periodos.filter((p) => !p.Nombre).length})
              </button>
            )}
          </CardBody>
        )}

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
        ) : visibles.length === 0 ? (
          <EmptyState
            title="Nada con ese nombre"
            description="Hay corridas, pero ninguna de las que estás filtrando."
            action={
              <Button variant="secondary" onClick={() => setFiltro({ tipo: "todas" })}>
                Ver todas
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Periodo</Th>
                <Th>Corrida</Th>
                <Th>Se paga</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Recibos</Th>
                <Th className="text-right">Neto</Th>
                <Th>Estado</Th>
                <Th className="w-24" />
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
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
                    <Td>
                      {p.Nombre ? (
                        <button
                          type="button"
                          onClick={() => setFiltro({ tipo: "nombre", nombre: p.Nombre! })}
                          className="text-[12.5px] font-medium text-ink-2 transition hover:text-brand hover:underline"
                          title={`Ver sólo las de ${p.Nombre}`}
                        >
                          {p.Nombre}
                        </button>
                      ) : (
                        <span className="text-[12.5px] text-ink-3">—</span>
                      )}
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
                      <div className="flex items-center gap-3">
                        <Link
                          href={`/emisores/${encodeURIComponent(rfc)}/nomina/${p.Id}`}
                          className="text-[12.5px] font-semibold text-brand hover:underline"
                        >
                          Abrir
                        </Link>
                        {recibos > 0 && p.TipoNomina !== "E" && (
                          <button
                            type="button"
                            onClick={() => setRepetir(String(p.Id))}
                            className="text-[12.5px] font-semibold text-ink-3 transition hover:text-brand hover:underline"
                            title="Crear la corrida del periodo siguiente con esta misma gente"
                          >
                            Repetir
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>

      {repetir && (
        <RepetirCorridaModal
          rfc={rfc}
          idPeriodo={repetir}
          onClose={() => setRepetir(null)}
          onCreada={(id, empleados) => {
            setRepetir(null);
            toast(`Corrida creada y calculada para ${empleados} empleados`);
            router.push(`/emisores/${encodeURIComponent(rfc)}/nomina/${id}`);
          }}
        />
      )}

      {abierto && (
        <CorridaFormModal
          rfc={rfc}
          nombres={nombres}
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
