import { NextRequest, NextResponse } from "next/server";
import { timbrarNominaManual } from "@/lib/nominaManual";
import { normalizarForm } from "@/lib/nominaManualShared";

/**
 * Timbra una nómina capturada a mano. Si viene de una prenómina guardada
 * (`idPrenomina`), se le anota el resultado.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as
    | { emisorToken?: string; form?: unknown; idPrenomina?: string }
    | null;

  if (!body?.emisorToken || !body.form) {
    return NextResponse.json({ error: "Faltan emisorToken o form" }, { status: 400 });
  }

  const r = await timbrarNominaManual(
    decodeURIComponent(rfc), body.emisorToken, normalizarForm(body.form), body.idPrenomina || undefined
  );

  // Siempre 200: que no se haya timbrado es un resultado que la pantalla
  // tiene que pintar, no un fallo de la petición.
  return NextResponse.json(r);
}
