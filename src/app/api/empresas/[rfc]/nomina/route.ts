import { NextRequest, NextResponse } from "next/server";
import { getPeriodos, savePeriodo, type PeriodoInput } from "@/lib/nomina";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  return NextResponse.json({ periodos: await getPeriodos(decodeURIComponent(rfc)) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as PeriodoInput | null;

  if (!body?.periodicidad || !body?.fechaInicialPago || !body?.fechaFinalPago
      || !body?.fechaPago || !body?.diasPagados) {
    return NextResponse.json({ error: "Faltan datos del periodo" }, { status: 400 });
  }

  const resp = await savePeriodo(decodeURIComponent(rfc), body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true, id: resp.Id, periodo: resp.Periodo });
}
