import { NextRequest, NextResponse } from "next/server";
import { timbrarFactura, type NuevaFacturaInput } from "@/lib/timbrado";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as
    | (NuevaFacturaInput & { emisorToken: string })
    | null;

  if (!body?.emisorToken || !body?.rfcEmisor || !body?.conceptos?.length) {
    return NextResponse.json({ error: "Faltan datos de la factura" }, { status: 400 });
  }

  const resp = await timbrarFactura(body.emisorToken, body);

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json(resp);
}
