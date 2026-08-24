import { NextRequest, NextResponse } from "next/server";
import { getPagosRelacionados } from "@/lib/facturas";

/**
 * Pagos previos detectados para una factura PPD (ver getPagosRelacionados).
 * `rfcEmisor` es obligatorio como query param porque el backend necesita
 * validar que el emisor pertenece al usuario autenticado.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ uuid: string }> }
) {
  const { uuid } = await params;
  const rfcEmisor = request.nextUrl.searchParams.get("rfcEmisor") ?? "";

  if (!rfcEmisor) {
    return NextResponse.json({ error: "Falta el RFC del emisor" }, { status: 400 });
  }

  const resp = await getPagosRelacionados(rfcEmisor, decodeURIComponent(uuid));

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json(resp);
}
