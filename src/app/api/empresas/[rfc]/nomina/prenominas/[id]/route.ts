import { NextRequest, NextResponse } from "next/server";
import { deletePrenomina, getPrenomina, savePrenomina } from "@/lib/nominaManual";
import { normalizarForm } from "@/lib/nominaManualShared";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await getPrenomina(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 404 });
  }
  return NextResponse.json({ prenomina: resp.Prenomina });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as { nombre?: string; form?: unknown } | null;

  if (!body?.nombre?.trim() || !body.form) {
    return NextResponse.json({ error: "Faltan nombre o form" }, { status: 400 });
  }

  const resp = await savePrenomina(decodeURIComponent(rfc), body.nombre.trim(), normalizarForm(body.form), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    id: resp.Id,
    prenomina: resp.Prenomina,
    errores: resp.Errores ?? [],
    avisos: resp.Avisos ?? [],
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await deletePrenomina(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
