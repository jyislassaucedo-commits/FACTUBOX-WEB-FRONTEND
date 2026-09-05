import { NextRequest, NextResponse } from "next/server";
import { bajaEmpleado, editEmpleado, type EmpleadoInput } from "@/lib/empleados";
import { revisarEntradaEmpleado } from "@/lib/empleadoEntrada";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as EmpleadoInput | null;

  const motivo = revisarEntradaEmpleado(body);
  if (motivo !== null || body === null) {
    return NextResponse.json({ error: motivo ?? "Faltan datos del empleado" }, { status: 400 });
  }

  const resp = await editEmpleado(decodeURIComponent(rfc), id, body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({ ok: true, faltantes: resp.Faltantes ?? [] });
}

/**
 * Baja logica, o reactivacion con ?reactivar=1. No hay borrado: los recibos
 * timbrados apuntan al empleado por llave foranea.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const sp = request.nextUrl.searchParams;

  const resp = await bajaEmpleado(decodeURIComponent(rfc), id, {
    reactivar: sp.get("reactivar") === "1",
    fechaBaja: sp.get("fechaBaja") ?? undefined,
  });

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
