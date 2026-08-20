import { NextRequest, NextResponse } from "next/server";
import { getConfigPdf, saveConfigPdf, type ConfigPdfForm } from "@/lib/configPdf";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const config = await getConfigPdf(decodeURIComponent(rfc));
  return NextResponse.json({ config });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as ConfigPdfForm | null;

  if (!body) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 });
  }

  const resp = await saveConfigPdf(decodeURIComponent(rfc), body);

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
