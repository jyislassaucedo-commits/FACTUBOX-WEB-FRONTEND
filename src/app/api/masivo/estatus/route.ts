import { NextRequest, NextResponse } from "next/server";
import { estatusLote } from "@/lib/masivo";

/** El avance. Se consulta en bucle, así que no hace nada más que preguntar. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { rfc?: string; idLote?: number } | null;
  if (!body?.rfc || !body?.idLote) {
    return NextResponse.json({ error: "Falta el emisor o el lote" }, { status: 400 });
  }

  const res = await estatusLote(body.rfc, body.idLote);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ lote: res });
}
