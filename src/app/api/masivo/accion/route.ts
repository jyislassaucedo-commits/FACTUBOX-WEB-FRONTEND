import { NextRequest, NextResponse } from "next/server";
import { cancelarLote, confirmarLote, reintentarLote } from "@/lib/masivo";

/** Confirmar, cancelar o reintentar. Tres verbos, una sola ruta. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    rfc?: string;
    idLote?: number;
    accion?: string;
  } | null;

  if (!body?.rfc || !body?.idLote || !body?.accion) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const res =
    body.accion === "CONFIRMAR"
      ? await confirmarLote(body.rfc, body.idLote)
      : body.accion === "CANCELAR"
        ? await cancelarLote(body.rfc, body.idLote)
        : body.accion === "REINTENTAR"
          ? await reintentarLote(body.rfc, body.idLote)
          : { error: `Acción no reconocida: ${body.accion}` };

  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ lote: res });
}
