"use client";

import { useState } from "react";
import { Button, ConfirmButton, useToast } from "@/components/ui";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import {
  EMISOR_ACTIVADO,
  EMISOR_DESACTIVADO,
  emisorEstaActivo,
  type EstatusEmisor,
} from "@/lib/emisoresShared";

/**
 * Interruptor de activacion de un emisor, compartido por el renglon del
 * listado y la tarjeta de la pantalla del emisor.
 *
 * Asimetria deliberada entre las dos direcciones:
 *
 *  - Desactivar usa ConfirmButton (dos pasos, tono destructivo). Corta la
 *    facturacion con ese RFC para toda la cuenta, asi que merece la misma
 *    friccion que un borrado.
 *  - Reactivar es un boton normal de un clic. Devolver una capacidad no rompe
 *    nada, y pedir confirmacion para eso solo entrena a la gente a confirmar
 *    sin leer, que es justo lo que arruina la confirmacion del otro lado.
 */
export function EstatusEmisorAccion({
  rfc,
  estatus,
  onCambio,
  tamano = "sm",
}: {
  rfc: string;
  estatus: string;
  /** Se llama con el estatus nuevo ya confirmado por el servidor. */
  onCambio: (estatusNuevo: EstatusEmisor) => void;
  tamano?: "sm" | "md";
}) {
  const [enviando, setEnviando] = useState(false);
  const toast = useToast();
  const progreso = useProgresoManual();

  const activo = emisorEstaActivo(estatus);
  const destino: EstatusEmisor = activo ? EMISOR_DESACTIVADO : EMISOR_ACTIVADO;

  async function cambiar() {
    setEnviando(true);
    const terminarProgreso = progreso(
      destino === EMISOR_DESACTIVADO
        ? `Desactivando ${rfc}…`
        : `Reactivando ${rfc}…`
    );
    try {
      const res = await fetch(
        `/api/empresas/${encodeURIComponent(rfc)}/estatus`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estatus: destino }),
        }
      );
      const body = await res.json().catch(() => null);

      if (!res.ok) {
        toast(body?.error ?? "No se pudo cambiar el estatus del emisor");
        return;
      }

      onCambio(destino);
      toast(
        destino === EMISOR_DESACTIVADO
          ? `${rfc} quedó desactivado: ya no aparece al crear facturas`
          : `${rfc} está activo de nuevo`
      );
    } catch {
      toast("No se pudo contactar al servidor");
    } finally {
      terminarProgreso();
      setEnviando(false);
    }
  }

  if (!activo) {
    return (
      <Button
        variant="secondary"
        size={tamano}
        onClick={cambiar}
        disabled={enviando}
      >
        {enviando ? "Activando…" : "Reactivar"}
      </Button>
    );
  }

  return (
    <ConfirmButton
      onConfirm={cambiar}
      pending={enviando}
      pendingLabel="Desactivando…"
      confirmLabel="¿Desactivar?"
    >
      Desactivar
    </ConfirmButton>
  );
}
