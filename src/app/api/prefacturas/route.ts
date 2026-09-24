import { NextRequest, NextResponse } from "next/server";
import { guardarPrefactura, listarPrefacturas } from "@/lib/prefacturas";
import type { CuerpoFactura } from "@/lib/facturaEntrada";

/**
 * Guarda el comprobante que se está armando como prefactura en la nube.
 * Puede estar incompleto: una prefactura es un borrador. Lo que no puede
 * faltar es el emisor, el identificador local y el tipo.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { rfcEmisor?: string; uuidLocal?: string; cuerpo?: CuerpoFactura } | null;
  if (!body?.rfcEmisor || !body.uuidLocal || !body.cuerpo?.tipoDeComprobante) {
    return NextResponse.json({ error: "Faltan datos para guardar la prefactura" }, { status: 400 });
  }
  const resp = await guardarPrefactura(body.rfcEmisor, body.uuidLocal, body.cuerpo);
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ id: resp.Id, resultado: resp.Result });
}

/** Lista de prefacturas de un emisor: ?rfc=&filtro=todas|cartaporte|facturas&q=&pagina= */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const rfc = sp.get("rfc") ?? "";
  if (!rfc) return NextResponse.json({ error: "Falta el emisor" }, { status: 400 });
  const r = await listarPrefacturas(rfc, {
    filtro: sp.get("filtro") ?? "todas",
    q: sp.get("q") ?? "",
    pagina: Number(sp.get("pagina") ?? 1) || 1,
  });
  if (!r) return NextResponse.json({ error: "No se pudieron consultar las prefacturas" }, { status: 502 });
  return NextResponse.json(r);
}
