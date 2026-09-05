import { NextRequest, NextResponse } from "next/server";
import { getCandidatos, quitarRecibo } from "@/lib/nomina";

/** A quién se le podría pagar en este periodo, con sus banderas. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await getCandidatos(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ candidatos: resp.Candidatos ?? [] });
}

/** Saca a alguien de la corrida. Sus incidencias se quedan. */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const idEmpleado = request.nextUrl.searchParams.get("idEmpleado");
  if (!idEmpleado) {
    return NextResponse.json({ error: "Falta idEmpleado" }, { status: 400 });
  }
  const resp = await quitarRecibo(decodeURIComponent(rfc), id, idEmpleado);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
