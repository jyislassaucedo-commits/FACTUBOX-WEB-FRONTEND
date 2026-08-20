"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  Note,
  Pill,
  RowActions,
  SearchInput,
  Segmented,
  Table,
  Td,
  Th,
  Toolbar,
  useToast,
} from "@/components/ui";
import { ReceptorFormModal } from "./ReceptorFormModal";
import { iniciales } from "@/lib/emisorNav";
import { USOS_CFDI } from "@/lib/catalogosSat";
import type { Receptor } from "@/lib/receptores";

/** Paleta fija para los avatares: se elige por hash del RFC, no por indice,
 *  asi un receptor conserva su color aunque cambie el orden de la lista. */
const AVATARES = [
  "text-info bg-info-bg",
  "text-teal bg-teal-bg",
  "text-violet bg-violet-bg",
  "text-ok bg-ok-bg",
  "text-warn bg-warn-bg",
];

function colorDe(clave: string) {
  let hash = 0;
  for (let i = 0; i < clave.length; i++) hash = (hash * 31 + clave.charCodeAt(i)) | 0;
  return AVATARES[Math.abs(hash) % AVATARES.length];
}

export function ReceptoresSection({
  rfc,
  receptores,
}: {
  rfc: string;
  receptores: Receptor[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [uso, setUso] = useState<string>("all");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);

  /** Solo los usos que este emisor realmente tiene, para no llenar la barra. */
  const usosPresentes = useMemo(() => {
    const set = new Set(receptores.map((r) => r.UsoCfdi).filter(Boolean));
    return Array.from(set).sort();
  }, [receptores]);

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    return receptores.filter(
      (r) =>
        (uso === "all" || r.UsoCfdi === uso) &&
        (!query || `${r.Nombre} ${r.Rfc}`.toLowerCase().includes(query))
    );
  }, [receptores, q, uso]);

  const sinRfc = receptores.filter((r) => !r.Rfc?.trim());

  async function handleEliminar(receptor: Receptor) {
    setBorrando(receptor.Rfc);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/receptores`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfcReceptor: receptor.Rfc }),
      });
      const body = await res.json();

      if (!res.ok) {
        toast(body.error ?? "No se pudo eliminar el receptor", "danger");
        return;
      }
      toast("Receptor eliminado");
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="space-y-4">
      {sinRfc.length > 0 && (
        <Note tone="warn" title={`${sinRfc.length} receptor(es) sin RFC`}>
          {sinRfc.map((r) => r.Nombre).join(", ")}. Un CFDI no se puede timbrar sin el RFC del
          receptor: edítalos o elimínalos.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Receptores"
          description="Clientes que puedes seleccionar al hacer una factura."
          action={
            <Button variant="primary" onClick={() => setModalAbierto(true)}>
              Agregar receptor
            </Button>
          }
        />

        <Toolbar>
          <SearchInput
            placeholder="Buscar por nombre o RFC…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {usosPresentes.length > 1 && (
            <Segmented
              ariaLabel="Filtrar por uso de CFDI"
              value={uso}
              onChange={setUso}
              options={[
                { value: "all", label: "Todos" },
                ...usosPresentes.map((u) => ({ value: u, label: u })),
              ]}
            />
          )}
        </Toolbar>

        {filtrados.length === 0 ? (
          <EmptyState
            title={
              receptores.length === 0 ? "Sin receptores todavía" : "Ningún receptor coincide"
            }
            description={
              receptores.length === 0
                ? "Agrega tus clientes frecuentes para no capturarlos en cada factura."
                : "Prueba con otro nombre o RFC."
            }
            action={
              receptores.length === 0 ? (
                <Button variant="primary" onClick={() => setModalAbierto(true)}>
                  Agregar el primero
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Receptor</Th>
                <Th>RFC</Th>
                <Th>Uso CFDI</Th>
                <Th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const usoLabel = USOS_CFDI.find((u) => u.value === r.UsoCfdi)?.label;
                return (
                  <tr key={r.Rfc || r.Nombre} className="group transition hover:bg-surface-2">
                    <Td>
                      <span className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10.5px] font-bold ${colorDe(
                            r.Rfc || r.Nombre
                          )}`}
                          aria-hidden
                        >
                          {iniciales(r.Nombre)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.3px] font-semibold text-ink">
                            {r.Nombre}
                          </span>
                          {r.CorreoElectronico && (
                            <span className="block truncate text-[11.3px] text-ink-3">
                              {r.CorreoElectronico}
                            </span>
                          )}
                        </span>
                      </span>
                    </Td>
                    <Td className="font-mono text-[12.5px]">
                      {r.Rfc?.trim() || <span className="text-warn">sin RFC</span>}
                    </Td>
                    <Td>
                      <Pill tone={r.UsoCfdi ? "neutral" : "warn"} title={usoLabel}>
                        {r.UsoCfdi || "sin uso"}
                      </Pill>
                    </Td>
                    <Td>
                      <RowActions>
                        <ConfirmButton
                          pending={borrando === r.Rfc}
                          onConfirm={() => handleEliminar(r)}
                        />
                      </RowActions>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <CardBody className="border-t border-line-2 py-3 text-[12px] text-ink-3">
          Mostrando {filtrados.length} de {receptores.length} receptores.
        </CardBody>
      </Card>

      {modalAbierto && (
        <ReceptorFormModal
          rfcEmisor={rfc}
          onClose={() => setModalAbierto(false)}
          onSaved={() => {
            setModalAbierto(false);
            toast("Receptor agregado");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
