import { NextRequest, NextResponse } from "next/server";
import { getFacturaPdf } from "@/lib/facturas";

/**
 * PDF de una factura timbrada. `idConfigPdf` es opcional (query string): si
 * no se manda, el backend usa el diseño ya guardado en la factura o uno por
 * default.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const idConfigPdf = request.nextUrl.searchParams.get("idConfigPdf") ?? undefined;
  const resp = await getFacturaPdf(decodeURIComponent(uuid), idConfigPdf);

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 502 });
  }

  return NextResponse.json({ base64: resp.PDF_Base64 });
}
