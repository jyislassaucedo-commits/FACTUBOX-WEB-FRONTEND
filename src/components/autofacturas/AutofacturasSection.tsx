"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  CopyButton,
  EmptyState,
  Field,
  Input,
  Modal,
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
import { buttonClass, type PillTone } from "@/components/ui/styles";
import { emisorHref, formatoFecha } from "@/lib/emisorNav";
import type { AutofacturaEmisor } from "@/lib/autofacturasEmisor";
import { formatoDinero, type EstadoAutofactura } from "@/lib/autofacturaShared";

type Filtro = "all" | EstadoAutofactura;

const ESTADO: Record<EstadoAutofactura, { label: string; tone: PillTone }> = {
  PENDIENTE: { label: "Pendiente", tone: "warn" },
  TIMBRADA: { label: "Timbrada", tone: "ok" },
  EXPIRADA: { label: "Expirada", tone: "neutral" },
  CANCELADA: { label: "Cancelada", tone: "danger" },
};

/**
 * Las ventas que quedaron para que el cliente se facture solo (autofactura
 * por QR): las que dejan los integradores por apiAutofacturaV2 y las que el
 * emisor crea aquí mismo. Desde aquí se ve en qué van, se reenvía la
 * invitación (o se corrige el correo) y se retira un enlace que ya no debe
 * facturarse.
 */
export function AutofacturasSection({
  rfc,
  autofacturas,
}: {
  rfc: string;
  autofacturas: AutofacturaEmisor[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("all");
  const [ocupado, setOcupado] = useState<string | null>(null);
  const [reenvio, setReenvio] = useState<AutofacturaEmisor | null>(null);
  const [qr, setQr] = useState<AutofacturaEmisor | null>(null);

  const conteo = useMemo(() => {
    const c: Record<EstadoAutofactura, number> = { PENDIENTE: 0, TIMBRADA: 0, EXPIRADA: 0, CANCELADA: 0 };
    for (const a of autofacturas) c[a.Estado]++;
    return c;
  }, [autofacturas]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return autofacturas.filter(
      (a) =>
        (filtro === "all" || a.Estado === filtro) &&
        (!query || `${a.Referencia} ${a.UUID} ${a.EmailReceptor} ${a.Codigo}`.toLowerCase().includes(query))
    );
  }, [autofacturas, q, filtro]);

  const sinCorreo = autofacturas.filter((a) => a.Estado === "PENDIENTE" && a.EmailReceptor && a.CorreoEnviado !== "SI");

  async function cancelar(a: AutofacturaEmisor) {
    setOcupado(a.Codigo);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/autofacturas/${a.Codigo}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo cancelar", "danger");
        return;
      }
      toast("Enlace cancelado");
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  return (
    <div className="space-y-4">
      {sinCorreo.length > 0 && (
        <Note tone="warn" title={`${sinCorreo.length} invitación(es) sin enviar`}>
          El correo al comprador falló en {sinCorreo.map((a) => a.Referencia || a.Codigo.slice(0, 8)).join(", ")}.
          Puedes reenviarlo desde la fila; el QR del ticket sigue sirviendo mientras tanto.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Autofacturas por QR"
          description="Ventas pendientes de que el cliente capture sus datos y se facture solo. Cada una consume un timbre hasta que el cliente termina."
          action={
            <Link href={`${emisorHref(rfc, "autofacturas")}/nueva`} className={buttonClass("primary")}>
              Nueva autofactura
            </Link>
          }
        />

        <Toolbar>
          <SearchInput
            placeholder="Buscar por referencia, UUID o correo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Segmented<Filtro>
            ariaLabel="Filtrar por estado"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "all", label: `Todas (${autofacturas.length})` },
              { value: "PENDIENTE", label: `Pendientes (${conteo.PENDIENTE})` },
              { value: "TIMBRADA", label: `Timbradas (${conteo.TIMBRADA})` },
              { value: "EXPIRADA", label: `Expiradas (${conteo.EXPIRADA})` },
              { value: "CANCELADA", label: `Canceladas (${conteo.CANCELADA})` },
            ]}
          />
        </Toolbar>

        {filtradas.length === 0 ? (
          <EmptyState
            title={autofacturas.length === 0 ? "Sin autofacturas todavía" : "Ninguna coincide"}
            description={
              autofacturas.length === 0
                ? "Crea una aquí o conecta tu punto de venta con apiAutofacturaV2; aparecen con su estado."
                : "Prueba con otra referencia, UUID o correo, o cambia el filtro."
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Venta</Th>
                <Th>Total</Th>
                <Th>Estado</Th>
                <Th>Comprador</Th>
                <Th>Vence</Th>
                <Th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((a) => {
                const estado = ESTADO[a.Estado];
                return (
                  <tr key={a.Codigo} className="group transition hover:bg-surface-2">
                    <Td>
                      <span className="block text-[13.3px] font-semibold text-ink">
                        {a.Referencia || <span className="font-mono font-normal text-ink-3">{a.Codigo.slice(0, 12)}…</span>}
                      </span>
                      <span className="block text-[11.3px] text-ink-3">{formatoFecha(a.FechaReg)}</span>
                    </Td>
                    <Td className="tabular-nums">{formatoDinero(a.Total, a.Moneda)}</Td>
                    <Td>
                      <Pill tone={estado.tone} title={a.UltimoError || undefined}>
                        {estado.label}
                      </Pill>
                      {a.Estado === "TIMBRADA" && a.UUID && (
                        <span className="mt-1 block">
                          <CopyButton value={a.UUID} label={`${a.UUID.slice(0, 8)}…`} />
                        </span>
                      )}
                      {a.Estado === "PENDIENTE" && a.Intentos > 0 && (
                        <span className="mt-1 block text-[11px] text-warn" title={a.UltimoError}>
                          {a.Intentos} intento{a.Intentos === 1 ? "" : "s"} fallido{a.Intentos === 1 ? "" : "s"}
                        </span>
                      )}
                    </Td>
                    <Td>
                      {a.EmailReceptor ? (
                        <span className="block truncate text-[12.5px] text-ink-2" title={a.EmailReceptor}>
                          {a.EmailReceptor}
                          <span className={`ml-1 text-[11px] ${a.CorreoEnviado === "SI" ? "text-ok" : "text-warn"}`}>
                            {a.CorreoEnviado === "SI" ? "· correo enviado" : "· sin enviar"}
                          </span>
                        </span>
                      ) : (
                        <span className="text-[12px] text-ink-4">sin correo (solo QR)</span>
                      )}
                    </Td>
                    <Td className="text-[12.5px] text-ink-2">{formatoFecha(a.Expira)}</Td>
                    <Td>
                      <RowActions>
                        <Button size="sm" onClick={() => setQr(a)}>
                          QR
                        </Button>
                        <CopyButton value={a.Url} label="enlace" />
                        {a.Estado === "PENDIENTE" && (
                          <>
                            <Button size="sm" onClick={() => setReenvio(a)}>
                              Correo
                            </Button>
                            <ConfirmButton
                              pending={ocupado === a.Codigo}
                              onConfirm={() => cancelar(a)}
                              confirmLabel="¿Retirar?"
                              pendingLabel="Cancelando…"
                            >
                              Cancelar
                            </ConfirmButton>
                          </>
                        )}
                      </RowActions>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <CardBody className="border-t border-line-2 py-3 text-[12px] text-ink-3">
          Mostrando {filtradas.length} de {autofacturas.length}. Las expiradas que nadie facturó van en la factura global del periodo.
        </CardBody>
      </Card>

      {qr && (
        <Modal title={qr.Referencia ? `QR de ${qr.Referencia}` : "QR de la venta"} onClose={() => setQr(null)}>
          <div className="space-y-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado por el backend, tamaño fijo */}
            <img src={`/api/publico/autofactura/${qr.Codigo}/qr`} alt="Código QR para facturar" width={264} height={264} className="mx-auto rounded-lg border border-line bg-white p-2" />
            <p className="text-[12px] text-ink-3">El comprador lo escanea y llega a la página para capturar sus datos.</p>
            <p className="break-all font-mono text-[11.5px] text-ink-2">{qr.Url}</p>
            <div className="flex justify-center gap-2">
              <CopyButton value={qr.Url} label="Copiar enlace" />
              <a href={`/api/publico/autofactura/${qr.Codigo}/qr`} download={`qr-${qr.Referencia || qr.Codigo.slice(0, 8)}.png`} className="focus-brand inline-flex items-center rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink hover:border-brand hover:text-brand">
                Descargar PNG
              </a>
            </div>
          </div>
        </Modal>
      )}

      {reenvio && (
        <ReenviarCorreoModal
          rfc={rfc}
          autofactura={reenvio}
          onClose={() => setReenvio(null)}
          onEnviado={() => {
            setReenvio(null);
            toast("Invitación enviada");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReenviarCorreoModal({
  rfc,
  autofactura,
  onClose,
  onEnviado,
}: {
  rfc: string;
  autofactura: AutofacturaEmisor;
  onClose: () => void;
  onEnviado: () => void;
}) {
  const [email, setEmail] = useState(autofactura.EmailReceptor);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/autofacturas/${autofactura.Codigo}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "reenviar", email: email.trim() }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo enviar el correo");
        return;
      }
      onEnviado();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      title="Reenviar invitación"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cerrar</Button>
          <Button variant="primary" type="submit" form="form-reenvio" disabled={enviando || !email.trim()}>
            {enviando ? "Enviando…" : "Enviar"}
          </Button>
        </>
      }
    >
      <form id="form-reenvio" onSubmit={enviar} className="space-y-3">
        <p className="text-[13px] text-ink-2">
          Se manda de nuevo el correo con el QR y el enlace para facturar {autofactura.Referencia ? `la venta ${autofactura.Referencia}` : "esta venta"}.
          Si el comprador dio mal su correo en caja, corrígelo aquí.
        </p>
        <Field label="Correo del comprador">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        {autofactura.CorreoError && (
          <Note tone="warn" title="Último intento">{autofactura.CorreoError}</Note>
        )}
        {error && <Note tone="danger">{error}</Note>}
      </form>
    </Modal>
  );
}
