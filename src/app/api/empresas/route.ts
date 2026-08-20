import { NextRequest, NextResponse } from "next/server";
import { saveEmisor, type EmisorInput } from "@/lib/emisores";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as EmisorInput | null;

  if (!body?.rfc || !body?.nombre || !body?.regimenFiscal || !body?.domicilioFiscal) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  const resp = await saveEmisor(body);

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({ token: resp.Token });
}
