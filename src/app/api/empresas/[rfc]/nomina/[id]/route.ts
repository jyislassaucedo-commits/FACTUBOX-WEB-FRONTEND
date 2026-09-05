import { NextRequest, NextResponse } from "next/server";
import { deletePeriodo, getPeriodo, savePeriodo, type PeriodoInput } from "@/lib/nomina";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await getPeriodo(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({
    periodo: resp.Periodo,
    recibos: resp.Recibos,
    conceptos: resp.Conceptos ?? {},
  });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await deletePeriodo(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * Corrige la corrida. El backend rechaza tocar una ya cerrada: sus fechas
 * decidieron qué tarifa se aplicó a lo que ya se timbró.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as PeriodoInput | null;

  if (!body?.periodicidad || !body?.fechaInicialPago || !body?.fechaFinalPago
      || !body?.fechaPago || !body?.diasPagados) {
    return NextResponse.json({ error: "Faltan datos del periodo" }, { status: 400 });
  }

  const resp = await savePeriodo(decodeURIComponent(rfc), body, id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id, periodo: resp.Periodo });
}
