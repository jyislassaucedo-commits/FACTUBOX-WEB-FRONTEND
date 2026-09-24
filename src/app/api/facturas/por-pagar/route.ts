import { NextRequest, NextResponse } from "next/server";
import { callPhpApi } from "@/lib/phpApi";
import { getSession } from "@/lib/session";
import type { PorPagar } from "@/lib/pagosCaptura";

/**
 * Facturas PPD con saldo del emisor, agrupadas por receptor: la primera
 * pantalla de "De Factubox" en el complemento de pago. Todo el historial; el
 * saldo sale de FACTURA_PAGO_DOCTO, sin leer XML.
 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const rfcEmisor = request.nextUrl.searchParams.get("rfcEmisor") ?? "";
  if (!rfcEmisor) return NextResponse.json({ error: "Falta el emisor" }, { status: 400 });

  try {
    const resp = await callPhpApi<PorPagar>("/endpoint/web/porPagarWeb.php", {
      SessionToken: session.token,
      RfcEmisor: rfcEmisor,
    });
    if (resp.Error !== "0") {
      return NextResponse.json({ error: resp.DescripError }, { status: 400 });
    }
    return NextResponse.json({ Receptores: resp.Receptores, Facturas: resp.Facturas });
  } catch {
    return NextResponse.json({ error: "No se pudieron consultar las facturas por pagar" }, { status: 502 });
  }
}
