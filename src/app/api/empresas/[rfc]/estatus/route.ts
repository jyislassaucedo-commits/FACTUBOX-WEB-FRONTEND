import { NextRequest, NextResponse } from "next/server";
import { cambiarEstatusEmisor } from "@/lib/emisores";
import {
  EMISOR_ACTIVADO,
  EMISOR_DESACTIVADO,
  type EstatusEmisor,
} from "@/lib/emisoresShared";

/**
 * PUT /api/empresas/<rfc>/estatus  { estatus: "ACTIVADO" | "DESACTIVADO" }
 *
 * El PHP vuelve a validar todo esto (el estatus, que el emisor sea de la
 * cuenta, que quien pide sea el titular). La validacion de aqui existe solo
 * para responder 400 sin pagar un viaje al backend, no como control de
 * seguridad: este handler es tan alcanzable como el endpoint que llama.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = await request.json().catch(() => null);
  const estatus = typeof body?.estatus === "string" ? body.estatus : "";

  if (estatus !== EMISOR_ACTIVADO && estatus !== EMISOR_DESACTIVADO) {
    return NextResponse.json(
      { error: "Estatus inválido: se espera ACTIVADO o DESACTIVADO" },
      { status: 400 }
    );
  }

  const resp = await cambiarEstatusEmisor(
    decodeURIComponent(rfc),
    estatus as EstatusEmisor
  );

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({ estatus: resp.Estatus, cambio: resp.Cambio });
}
