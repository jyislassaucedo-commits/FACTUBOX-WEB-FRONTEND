import { NextRequest, NextResponse } from "next/server";
import { callPhpApi } from "@/lib/phpApi";
import { getSession } from "@/lib/session";
import type { FacturaRelacionadaApi } from "@/lib/pagosCaptura";

/**
 * Varias facturas PPD a la vez, con sus impuestos de concepto y sus pagos
 * anteriores, para armar un complemento de pago. Las que no están en
 * Factubox vuelven con NoEncontrada (el front usa su XML).
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const rfcEmisor = typeof body?.rfcEmisor === "string" ? body.rfcEmisor : "";
  const uuids: string[] = Array.isArray(body?.uuids)
    ? body.uuids.filter((u: unknown): u is string => typeof u === "string")
    : [];

  if (!rfcEmisor || uuids.length === 0) {
    return NextResponse.json({ error: "Faltan el emisor o las facturas" }, { status: 400 });
  }

  try {
    const resp = await callPhpApi<{ Facturas: FacturaRelacionadaApi[] }>(
      "/endpoint/web/pagosRelacionadosWeb.php",
      { SessionToken: session.token, RfcEmisor: rfcEmisor, UUIDs: uuids }
    );
    if (resp.Error !== "0") {
      return NextResponse.json({ error: resp.DescripError }, { status: 400 });
    }
    return NextResponse.json({ facturas: resp.Facturas });
  } catch {
    return NextResponse.json({ error: "No se pudo consultar las facturas" }, { status: 502 });
  }
}
