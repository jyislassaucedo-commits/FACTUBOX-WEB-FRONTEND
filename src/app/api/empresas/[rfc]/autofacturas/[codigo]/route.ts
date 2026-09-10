import { NextRequest, NextResponse } from "next/server";
import { cancelarAutofactura, reenviarCorreoAutofactura } from "@/lib/autofacturasEmisor";

/** POST { accion: "reenviar", email? } — vuelve a mandar la invitación al comprador. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; codigo: string }> }
) {
  const { rfc, codigo } = await params;
  const body = (await request.json().catch(() => null)) as { accion?: string; email?: string } | null;

  if (body?.accion !== "reenviar") {
    return NextResponse.json({ error: "Acción no reconocida" }, { status: 400 });
  }

  const resp = await reenviarCorreoAutofactura(decodeURIComponent(rfc), codigo, body.email?.trim() || undefined);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  if (resp.CorreoEnviado !== "SI") {
    return NextResponse.json({ error: resp.CorreoError || "El correo no se pudo enviar" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE — cancela el enlace (solo pendientes). No es cancelación ante el SAT. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; codigo: string }> }
) {
  const { rfc, codigo } = await params;
  const resp = await cancelarAutofactura(decodeURIComponent(rfc), codigo);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
