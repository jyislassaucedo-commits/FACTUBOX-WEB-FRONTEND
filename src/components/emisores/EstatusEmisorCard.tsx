"use client";

import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Note, Pill } from "@/components/ui";
import { EstatusEmisorAccion } from "@/components/emisores/EstatusEmisorAccion";
import { emisorEstaActivo, etiquetaEstatusEmisor } from "@/lib/emisoresShared";

/**
 * Activacion del emisor, dentro de su propia pantalla.
 *
 * Deliberadamente NO ofrece eliminar. EMPRESA no tiene borrado en cascada:
 * FACTURA.empresa, SERIE.idempresa, RECEPTOR.idempresa, CONFIGPDF_EMPRESA y
 * SUBUSUARIO_EMISOR cuelgan de esta fila, y los CFDI timbrados hay que
 * conservarlos cinco anios. Desactivar cubre el caso real —dejar de usar un
 * emisor— sin poner en riesgo comprobantes ya emitidos.
 */
export function EstatusEmisorCard({
  rfc,
  estatus,
}: {
  rfc: string;
  estatus: string;
}) {
  const router = useRouter();
  const activo = emisorEstaActivo(estatus);

  return (
    <Card>
      <CardHeader
        title="Activación"
        description="Controla si puedes emitir facturas con este RFC."
        action={
          <Pill tone={activo ? "ok" : "neutral"}>
            {etiquetaEstatusEmisor(estatus)}
          </Pill>
        }
      />
      <CardBody className="space-y-3">
        {/* "info" y no "ok" para el estado activo: la pastilla verde del
            encabezado ya da esa señal, y repetirla en un bloque completo grita
            un logro donde solo se está describiendo la normalidad. */}
        <Note tone={activo ? "info" : "warn"} title={
          activo ? "Este emisor está disponible para facturar" : "Este emisor está desactivado"
        }>
          {activo
            ? "Aparece en el asistente de nueva factura. Si dejas de usarlo, desactívalo: sus facturas y catálogos se conservan y lo puedes reactivar cuando quieras."
            : "No aparece al crear facturas. Sus facturas emitidas, series y receptores siguen intactos y visibles."}
        </Note>

        <div className="flex items-center justify-between gap-3">
          <p className="text-[12.5px] leading-snug text-ink-3">
            Un emisor no se elimina: sus CFDI timbrados deben conservarse.
          </p>
          <EstatusEmisorAccion
            rfc={rfc}
            estatus={estatus}
            // router.refresh() y no estado local: esta pantalla se renderiza en
            // el servidor, y el hero, la checklist y los contadores de arriba
            // tambien dependen del emisor. Refrescar los deja consistentes de
            // una vez, en lugar de sincronizar copias a mano.
            onCambio={() => router.refresh()}
          />
        </div>
      </CardBody>
    </Card>
  );
}
