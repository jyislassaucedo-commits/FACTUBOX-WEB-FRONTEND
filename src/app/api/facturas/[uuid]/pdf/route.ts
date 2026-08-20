import { NextResponse } from "next/server";
import { getFacturaPdf } from "@/lib/facturas";

/**
 * PDF de una factura timbrada. PENDIENTE: hoy `getFacturaPdf` devuelve error
 * porque el backend todavía no expone un endpoint que lo genere.
 *
 * La ruta existe ya cableada para que, cuando el endpoint esté, solo haya que
 * rellenar `getFacturaPdf` en `src/lib/facturas.ts` — ni la UI ni esta ruta
 * tendrían que cambiar.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const resp = await getFacturaPdf(decodeURIComponent(uuid));

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 501 });
  }

  return NextResponse.json({ base64: resp.PDF_Base64 });
}
