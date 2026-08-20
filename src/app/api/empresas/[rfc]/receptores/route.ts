import { NextRequest, NextResponse } from "next/server";
import { deleteReceptor, getReceptores, saveReceptor, type ReceptorInput } from "@/lib/receptores";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const receptores = await getReceptores(decodeURIComponent(rfc));
  return NextResponse.json({ receptores });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as ReceptorInput | null;

  if (!body?.rfc || !body?.nombre || !body?.regimenFiscal || !body?.domicilioFiscal || !body?.usoCfdi) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resp = await saveReceptor(decodeURIComponent(rfc), body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as { rfcReceptor: string } | null;

  if (!body?.rfcReceptor) {
    return NextResponse.json({ error: "Faltan campos" }, { status: 400 });
  }

  const resp = await deleteReceptor(decodeURIComponent(rfc), body.rfcReceptor);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
