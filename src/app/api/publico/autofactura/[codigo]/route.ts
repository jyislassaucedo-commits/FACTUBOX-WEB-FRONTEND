import { NextRequest, NextResponse } from "next/server";
import { consultarAutofactura, timbrarAutofactura } from "@/lib/autofactura";
import type { DatosReceptorAutofactura } from "@/lib/autofacturaShared";

// Rutas públicas de la autofactura por QR. No pasan por el middleware (que
// excluye /api) y no piden sesión: el código es la única llave, igual que en
// el backend.

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const auto = await consultarAutofactura(codigo);
  if (!auto) {
    return NextResponse.json({ error: "Este enlace no corresponde a ninguna venta" }, { status: 404 });
  }
  return NextResponse.json(auto);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ codigo: string }> }
) {
  const { codigo } = await params;
  const body = (await request.json().catch(() => null)) as Partial<DatosReceptorAutofactura> | null;
  if (!body) {
    return NextResponse.json({ error: "Faltan los datos del receptor" }, { status: 400 });
  }

  const datos: DatosReceptorAutofactura = {
    rfc: (body.rfc ?? "").trim().toUpperCase(),
    nombre: (body.nombre ?? "").trim(),
    regimenFiscal: (body.regimenFiscal ?? "").trim(),
    domicilioFiscal: (body.domicilioFiscal ?? "").trim(),
    usoCfdi: (body.usoCfdi ?? "").trim().toUpperCase(),
    email: (body.email ?? "").trim().toLowerCase(),
  };

  const res = await timbrarAutofactura(codigo, datos);
  if (!res.ok) {
    return NextResponse.json(res.error, { status: res.status });
  }
  return NextResponse.json(res.resultado);
}
