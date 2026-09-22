import { NextRequest, NextResponse } from "next/server";
import { resultadosLote } from "@/lib/masivo";

/**
 * Los renglones del lote.
 *
 * "desde" es el último índice leído, no un offset: así se pueden ir cosechando
 * resultados mientras el lote corre sin que se repitan ni se salten renglones
 * aunque otros cambien de estado entre una consulta y otra.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    rfc?: string;
    idLote?: number;
    filtro?: string;
    desde?: number;
  } | null;

  if (!body?.rfc || !body?.idLote) {
    return NextResponse.json({ error: "Falta el emisor o el lote" }, { status: 400 });
  }

  const res = await resultadosLote(body.rfc, body.idLote, body.filtro ?? "TODOS", body.desde ?? 0);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json(res);
}
