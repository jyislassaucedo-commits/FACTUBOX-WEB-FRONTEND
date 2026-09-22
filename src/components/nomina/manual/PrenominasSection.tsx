"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardHeader, ConfirmButton, EmptyState, Pill, Table, Td, Th, useToast } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { dias, etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import type { PrenominaResumen } from "@/lib/nominaManual";

/**
 * Las plantillas de nómina manual del emisor.
 *
 * Cada renglón dice de quién es, qué periodo trae y cuánto le llega, y sobre
 * todo si ya se timbró y cuándo: una plantilla se timbra muchas veces, y
 * saber que la de Félix ya salió esta quincena es lo que evita el timbre
 * repetido.
 */
export function PrenominasSection({ rfc, prenominas }: { rfc: string; prenominas: PrenominaResumen[] }) {
  const router = useRouter();
  const toast = useToast();
  const [borrando, setBorrando] = useState<string | null>(null);
  const base = `/emisores/${encodeURIComponent(rfc)}/nomina`;

  async function borrar(p: PrenominaResumen) {
    setBorrando(p.Id);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/prenominas/${p.Id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo borrar", "danger");
        return;
      }
      toast(`Prenómina "${p.Nombre}" borrada`);
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="space-y-4">
      <nav className="text-[12.5px] text-ink-3">
        <Link href={base} className="hover:text-brand">Nómina</Link>
        <span aria-hidden> / </span>
        <span className="font-medium text-ink-2">Prenóminas</span>
      </nav>

      <Card>
        <CardHeader
          title="Prenóminas"
          description="Recibos capturados a mano y guardados como plantilla. Se abren, se ajustan las fechas y se timbran las veces que haga falta."
          action={
            <Link href={`${base}/manual`} className={buttonClass("primary")}>
              Nueva nómina manual
            </Link>
          }
        />
        {prenominas.length === 0 ? (
          <EmptyState
            title="Sin prenóminas todavía"
            description="Captura un recibo a mano —un finiquito, una jubilación, un pago especial— y guárdalo con nombre para reutilizarlo."
            action={
              <Link href={`${base}/manual`} className={buttonClass("primary")}>
                Capturar la primera
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Plantilla</Th>
                <Th>Empleado</Th>
                <Th>Periodo</Th>
                <Th className="text-right">Neto</Th>
                <Th>Último timbrado</Th>
                <Th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {prenominas.map((p) => {
                const veces = Number(p.VecesTimbrada) || 0;
                return (
                  <tr key={p.Id} className="transition hover:bg-surface-2">
                    <Td>
                      <span className="block text-[13.3px] font-semibold text-ink">{p.Nombre}</span>
                      <span className="block text-[11.3px] text-ink-3">
                        {p.TipoNomina === "E" ? "Extraordinaria" : etiquetaPeriodicidad(p.Periodicidad ?? "")}
                        {p.DiasPagados ? ` · ${dias(p.DiasPagados)} días` : ""}
                        {p.Serie ? ` · serie ${p.Serie}` : ""}
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-[12.8px] text-ink">{p.NombreEmpleado}</span>
                      <span className="block font-mono text-[11.3px] text-ink-3">
                        {p.Rfc}
                        {p.FechaBaja ? " · baja" : ""}
                      </span>
                    </Td>
                    <Td className="text-[12.5px] text-ink-2">
                      {p.FechaInicialPago && p.FechaFinalPago ? (
                        <>
                          {p.FechaInicialPago} al {p.FechaFinalPago}
                          <span className="block text-[11.3px] text-ink-3">se paga el {p.FechaPago}</span>
                        </>
                      ) : (
                        <span className="text-ink-3">sin fechas</span>
                      )}
                    </Td>
                    <Td className="text-right font-mono text-[12.5px] font-semibold">{pesos(p.Neto)}</Td>
                    <Td>
                      {p.Estado === "TIMBRADA" ? (
                        <>
                          <Pill tone="ok" title={p.UltimoUuid ?? undefined}>
                            timbrada {veces} {veces === 1 ? "vez" : "veces"}
                          </Pill>
                          <span className="mt-1 block font-mono text-[10.5px] text-ink-3">
                            {p.UltimoUuid?.slice(0, 8)}… · {p.UltimoTimbrado?.slice(0, 16)}
                          </span>
                        </>
                      ) : p.Estado === "ERROR" ? (
                        <Pill tone="danger" title={p.UltimoError ?? undefined}>
                          error{veces > 0 ? ` (antes ${veces})` : ""}
                        </Pill>
                      ) : (
                        <Pill tone="neutral">borrador</Pill>
                      )}
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-3">
                        <Link href={`${base}/manual?prenomina=${p.Id}`} className="text-[12.5px] font-semibold text-brand hover:underline">
                          Abrir
                        </Link>
                        <Link href={`${base}/manual?prenomina=${p.Id}&paso=revision`} className="text-[12.5px] font-semibold text-brand hover:underline">
                          Timbrar
                        </Link>
                        <Link
                          href={`${base}/manual?prenomina=${p.Id}&duplicar=1`}
                          className="text-[12.5px] font-semibold text-ink-3 hover:text-brand hover:underline"
                          title="Abrir una copia sin guardar"
                        >
                          Duplicar
                        </Link>
                        <ConfirmButton onConfirm={() => borrar(p)} pending={borrando === p.Id} confirmLabel="¿Borrar?">
                          Borrar
                        </ConfirmButton>
                      </div>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
