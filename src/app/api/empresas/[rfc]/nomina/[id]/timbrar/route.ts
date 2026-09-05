import { NextRequest, NextResponse } from "next/server";
import { timbrarRecibo } from "@/lib/nomina";

/**
 * Timbra UN recibo del periodo. El lote lo recorre el cliente, llamando a esta
 * ruta una vez por empleado: así se ve el avance y un rechazo no detiene a los
 * demás.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as
    | { idEmpleado?: string; emisorToken?: string; serie?: string }
    | null;

  if (!body?.idEmpleado || !body?.emisorToken || !body?.serie) {
    return NextResponse.json(
      { error: "Faltan idEmpleado, emisorToken o serie" },
      { status: 400 }
    );
  }

  const r = await timbrarRecibo(
    decodeURIComponent(rfc), body.emisorToken, id, body.idEmpleado, body.serie
  );

  // Siempre 200: que un recibo no se haya timbrado no es un fallo de la
  // petición, es un resultado que el cliente tiene que poder pintar junto a
  // los que sí salieron.
  return NextResponse.json(r);
}
