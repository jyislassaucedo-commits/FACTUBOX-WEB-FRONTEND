import { NextRequest, NextResponse } from "next/server";
import { borrarPrefactura, obtenerPrefactura } from "@/lib/prefacturas";

type Ctx = { params: Promise<{ id: string }> };

/** Una prefactura con su contenido (el JSON del CFDI): ?rfc= */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rfc = request.nextUrl.searchParams.get("rfc") ?? "";
  if (!rfc || !(Number(id) > 0)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const resp = await obtenerPrefactura(rfc, Number(id));
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 404 });
  let cfdi: unknown = null;
  try {
    cfdi = JSON.parse(Buffer.from(resp.Base64, "base64").toString("utf8"));
  } catch {
    return NextResponse.json({ error: "El contenido de la prefactura no se puede leer" }, { status: 422 });
  }
  return NextResponse.json({ prefactura: resp.Prefactura, cfdi });
}

export async function DELETE(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const rfc = request.nextUrl.searchParams.get("rfc") ?? "";
  if (!rfc || !(Number(id) > 0)) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const resp = await borrarPrefactura(rfc, Number(id));
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
