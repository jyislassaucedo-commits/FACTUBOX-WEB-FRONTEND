import { NextRequest, NextResponse } from "next/server";
import { validarFactura } from "@/lib/timbrado";
import { revisarEntradaFactura, type CuerpoFactura } from "@/lib/facturaEntrada";

/**
 * Ensaya el timbrado sin timbrar. El backend arma el CFDI, lo sella y lo pasa
 * por los esquemas, catálogos y reglas del SAT; no habla con el PAC y no
 * descuenta timbres, así que se puede llamar cuantas veces haga falta.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as CuerpoFactura | null;

  const motivo = revisarEntradaFactura(body);
  if (motivo !== null || body === null) {
    return NextResponse.json({ error: motivo ?? "Faltan datos de la factura" }, { status: 400 });
  }

  const resp = await validarFactura(body.emisorToken, body);

  // Error "1" aquí significa que la revisión no se pudo hacer (sesión caída,
  // CSD ausente), no que el comprobante esté mal: eso viene en Valido.
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json(resp);
}
