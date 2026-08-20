"use client";

import { useState } from "react";
import { Button, Field, Input, Modal, Note, Select } from "@/components/ui";
import { MOTIVOS_CANCELACION, type Factura } from "@/lib/facturasShared";
import { money } from "@/lib/cfdi";

/**
 * Cancelación ante el SAT. Es irreversible y consume un timbre de cancelación,
 * así que exige confirmar escribiendo el folio (serie-folio) de la factura.
 */
export function CancelarFacturaModal({
  factura,
  onClose,
  onCancelada,
}: {
  factura: Factura;
  onClose: () => void;
  onCancelada: () => void;
}) {
  const [motivo, setMotivo] = useState<string>("02");
  const [folioSustitucion, setFolioSustitucion] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const motivoInfo = MOTIVOS_CANCELACION.find((m) => m.value === motivo)!;
  const referencia = factura.Serie
    ? `${factura.Serie}-${factura.Folio}`
    : factura.Folio;
  const confirmado = confirmacion.trim().toUpperCase() === referencia.toUpperCase();

  async function handleCancelar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (motivoInfo.requiereSustitucion && !folioSustitucion.trim()) {
      setError("El motivo 01 exige el UUID de la factura que sustituye a ésta.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(factura.Uuid)}/cancelar`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rfcEmisor: factura.Rfc,
            rfcReceptor: factura.RfcReceptor,
            motivo,
            folioSustitucion: folioSustitucion.trim(),
          }),
        }
      );
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo cancelar la factura");
        return;
      }

      onCancelada();
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Modal
      title="Cancelar factura ante el SAT"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            No cancelar
          </Button>
          <Button
            type="submit"
            form="form-cancelar-factura"
            variant="primary"
            disabled={enviando || !confirmado}
          >
            {enviando ? "Cancelando…" : "Cancelar ante el SAT"}
          </Button>
        </>
      }
    >
      <form id="form-cancelar-factura" onSubmit={handleCancelar} className="space-y-4">
        <Note tone="warn" title="Esto es irreversible">
          Se envía la solicitud de cancelación al SAT y se consume un timbre de
          cancelación. Según el motivo, el receptor puede tener que aceptarla.
        </Note>

        <div className="rounded-xl border border-line bg-surface-2 p-3.5 text-[13px]">
          <p className="font-semibold text-ink">
            {referencia} · {money(factura.Total, factura.Moneda)}
          </p>
          <p className="mt-0.5 text-ink-3">{factura.NombreReceptor}</p>
          <p className="mt-1 break-all font-mono text-[11px] text-ink-3">{factura.Uuid}</p>
        </div>

        <Field label="Motivo de cancelación" hint={motivoInfo.ayuda}>
          <Select value={motivo} onChange={(e) => setMotivo(e.target.value)}>
            {MOTIVOS_CANCELACION.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>

        {motivoInfo.requiereSustitucion && (
          <Field
            label="UUID de la factura que la sustituye"
            hint="Debe ser una factura ya timbrada."
          >
            <Input
              className="font-mono"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={folioSustitucion}
              onChange={(e) => setFolioSustitucion(e.target.value)}
            />
          </Field>
        )}

        <Field
          label={`Escribe "${referencia}" para confirmar`}
          hint="Es a propósito: evita cancelar la factura equivocada."
        >
          <Input
            className="font-mono"
            autoComplete="off"
            value={confirmacion}
            onChange={(e) => setConfirmacion(e.target.value)}
          />
        </Field>

        {error && (
          <Note tone="danger" title="No se pudo cancelar">
            {error}
          </Note>
        )}
      </form>
    </Modal>
  );
}
