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
        <CorridaFormModal
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
