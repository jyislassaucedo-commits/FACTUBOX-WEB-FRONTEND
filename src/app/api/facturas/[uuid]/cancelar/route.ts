import { NextRequest, NextResponse } from "next/server";
import { cancelarFactura } from "@/lib/facturas";
import { MOTIVOS_CANCELACION } from "@/lib/facturasShared";

type Body = {
  rfcEmisor?: string;
  rfcReceptor?: string;
  motivo?: string;
  folioSustitucion?: string;
};

/** Cancelación real ante el SAT. Consume un timbre de cancelación. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const body = (await request.json().catch(() => null)) as Body | null;

  if (!body?.rfcEmisor || !body?.rfcReceptor || !body?.motivo) {
    return NextResponse.json(
      { error: "Faltan datos para cancelar (emisor, receptor o motivo)" },
      { status: 400 }
    );
  }

  const motivo = MOTIVOS_CANCELACION.find((m) => m.value === body.motivo);
  if (!motivo) {
    return NextResponse.json({ error: "Motivo de cancelación inválido" }, { status: 400 });
  }
  if (motivo.requiereSustitucion && !body.folioSustitucion?.trim()) {
    return NextResponse.json(
      { error: "El motivo 01 exige el UUID de la factura que sustituye a ésta" },
      { status: 400 }
    );
  }

  const resp = await cancelarFactura({
    rfcEmisor: body.rfcEmisor,
    rfcReceptor: body.rfcReceptor,
    uuid: decodeURIComponent(uuid),
    motivo: body.motivo,
    folioSustitucion: body.folioSustitucion?.trim() || "",
  });

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({ ok: true, ...resp });
}
