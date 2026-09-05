import { NextRequest, NextResponse } from "next/server";
import { deleteIncidencia, getIncidencias, saveIncidencia, type IncidenciaInput } from "@/lib/nomina";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await getIncidencias(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ porEmpleado: resp.PorEmpleado ?? {} });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as IncidenciaInput | null;

  if (!body?.idEmpleado || !body?.tipo) {
    return NextResponse.json({ error: "Faltan idEmpleado o tipo" }, { status: 400 });
  }

  const resp = await saveIncidencia(decodeURIComponent(rfc), id, body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true, incidencias: resp.Incidencias });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const idIncidencia = request.nextUrl.searchParams.get("idIncidencia");
  if (!idIncidencia) {
    return NextResponse.json({ error: "Falta idIncidencia" }, { status: 400 });
  }
  const resp = await deleteIncidencia(decodeURIComponent(rfc), id, idIncidencia);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
