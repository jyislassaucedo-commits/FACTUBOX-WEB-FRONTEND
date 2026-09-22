import { NextRequest, NextResponse } from "next/server";
import { proponerRecibo } from "@/lib/nominaManual";
import type { NominaManualForm } from "@/lib/nominaManualShared";

/**
 * Pide al motor de la corrida el caso base del empleado para este periodo
 * (sueldo por días, ISR, subsidio), sin guardar nada. Lo que devuelve se
 * vuelca al formulario y se edita a mano.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as
    | { idEmpleado?: string; periodo?: NominaManualForm["periodo"] }
    | null;

  if (!body?.idEmpleado || !body.periodo) {
    return NextResponse.json({ error: "Faltan idEmpleado o periodo" }, { status: 400 });
  }

  const resp = await proponerRecibo(decodeURIComponent(rfc), body.idEmpleado, body.periodo);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ propuesta: resp });
}
