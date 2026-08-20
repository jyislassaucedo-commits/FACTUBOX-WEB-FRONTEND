"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardBody,
  EmptyState,
  Pill,
  SearchInput,
  RowActions,
  Table,
  Td,
  Th,
  Toolbar,
  buttonClass,
  cx,
} from "@/components/ui";
import { formatoFecha, diasRestantes, iniciales } from "@/lib/emisorNav";
import { EstatusEmisorAccion } from "@/components/emisores/EstatusEmisorAccion";
import { emisorEstaActivo, etiquetaEstatusEmisor } from "@/lib/emisoresShared";
import type { Emisor } from "@/lib/emisores";

export default function EmisoresPage() {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/api/emisores")
      .then((res) => res.json())
      .then((body) => setEmisores(body.emisores ?? []))
      .finally(() => setLoading(false));
  }, []);

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return emisores;
    return emisores.filter((e) => `${e.Nombre} ${e.Rfc}`.toLowerCase().includes(query));
  }, [emisores, q]);

  /**
   * Actualiza en sitio el emisor que cambio de estatus.
   *
   * Esta pantalla carga los emisores con un fetch en useEffect, asi que un
   * router.refresh() no volveria a pedirlos. Reemplazar solo la fila afectada
   * tambien conserva el scroll y el texto de busqueda, que es lo que uno
   * espera al desactivar el quinto emisor de una lista larga.
   */
  function aplicarEstatus(rfc: string, estatusNuevo: string) {
    setEmisores((previos) =>
      previos.map((e) => (e.Rfc === rfc ? { ...e, Estatus: estatusNuevo } : e))
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Emisores</h1>
          <p className="mt-1 text-[13px] text-ink-3">Empresas con las que puedes facturar.</p>
        </div>
        <Link href="/emisores/nuevo" className={buttonClass("primary")}>
          Nuevo emisor
        </Link>
      </div>

      <Card>
        {emisores.length > 6 && (
          <Toolbar>
            <SearchInput
              placeholder="Buscar por nombre o RFC…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </Toolbar>
        )}

        {loading ? (
          <CardBody className="text-[13px] text-ink-3">Cargando…</CardBody>
        ) : filtrados.length === 0 ? (
          <EmptyState
            title={
              emisores.length === 0
                ? "Todavía no tienes emisores registrados"
                : "Ningún emisor coincide"
            }
            description={
              emisores.length === 0
                ? "Registra tu primera empresa para empezar a facturar."
                : "Prueba con otro nombre o RFC."
            }
            action={
              emisores.length === 0 ? (
                <Link href="/emisores/nuevo" className={buttonClass("primary")}>
                  Registrar emisor
                </Link>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Emisor</Th>
                <Th>Estatus</Th>
                <Th>CSD vigente hasta</Th>
                <Th className="text-right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((emisor) => {
                const dias = emisor.Cert ? diasRestantes(emisor.VigenciaCert) : null;
                const activo = emisorEstaActivo(emisor.Estatus);
                return (
                  <tr
                    key={emisor.Rfc}
                    // "group" alimenta el hover de RowActions. La fila
                    // desactivada se atenua para que se distinga de un vistazo
                    // en una lista larga, pero el texto se mantiene legible:
                    // sigue siendo informacion, no un elemento deshabilitado.
                    className={cx(
                      "group transition hover:bg-surface-2",
                      !activo && "opacity-70"
                    )}
                  >
                    <Td>
                      <Link
                        href={`/emisores/${encodeURIComponent(emisor.Rfc)}`}
                        className="focus-brand flex items-center gap-3 rounded"
                      >
                        <span
                          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-ink text-[11px] font-bold text-background"
                          aria-hidden
                        >
                          {iniciales(emisor.Nombre, 3)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.3px] font-semibold text-ink">
                            {emisor.Nombre}
                          </span>
                          <span className="block truncate font-mono text-[11.5px] text-ink-3">
                            {emisor.Rfc}
                          </span>
                        </span>
                      </Link>
                    </Td>
                    <Td>
                      <Pill tone={activo ? "ok" : "neutral"}>
                        {etiquetaEstatusEmisor(emisor.Estatus)}
                      </Pill>
                    </Td>
                    <Td>
                      {emisor.Cert ? (
                        <Pill
                          tone={
                            dias === null
                              ? "neutral"
                              : dias < 0
                                ? "danger"
                                : dias < 30
                                  ? "warn"
                                  : "neutral"
                          }
                        >
                          {formatoFecha(emisor.VigenciaCert)}
                        </Pill>
                      ) : (
                        <Pill tone="danger">Sin certificado</Pill>
                      )}
                    </Td>
                    <Td>
                      {/* Un emisor desactivado deja su boton siempre visible:
                          si estuviera oculto tras el hover, reactivarlo seria
                          un juego de adivinanzas. El de desactivar sigue la
                          convencion de la app y aparece al pasar el mouse. */}
                      {activo ? (
                        <RowActions>
                          <EstatusEmisorAccion
                            rfc={emisor.Rfc}
                            estatus={emisor.Estatus}
                            onCambio={(nuevo) => aplicarEstatus(emisor.Rfc, nuevo)}
                          />
                        </RowActions>
                      ) : (
                        <div className="flex justify-end">
                          <EstatusEmisorAccion
                            rfc={emisor.Rfc}
                            estatus={emisor.Estatus}
                            onCambio={(nuevo) => aplicarEstatus(emisor.Rfc, nuevo)}
                          />
                        </div>
                      )}
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
