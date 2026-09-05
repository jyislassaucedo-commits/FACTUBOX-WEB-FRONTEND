import { NextRequest, NextResponse } from "next/server";
import { getEmpleados, saveEmpleado, type EmpleadoInput } from "@/lib/empleados";
import { revisarEntradaEmpleado } from "@/lib/empleadoEntrada";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const incluirBajas = request.nextUrl.searchParams.get("incluirBajas") === "1";
  const empleados = await getEmpleados(decodeURIComponent(rfc), incluirBajas);
  return NextResponse.json({ empleados });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as EmpleadoInput | null;

  const motivo = revisarEntradaEmpleado(body);
  if (motivo !== null || body === null) {
    return NextResponse.json({ error: motivo ?? "Faltan datos del empleado" }, { status: 400 });
  }

  const resp = await saveEmpleado(decodeURIComponent(rfc), body);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  // Faltantes no es un error: son los datos que el SAT va a exigir al timbrar
  // y que todavia no estan. Se devuelven para que la pantalla los muestre.
  return NextResponse.json({
    ok: true,
    id: resp.Id,
    creado: resp.Creado === "1",
    faltantes: resp.Faltantes ?? [],
  });
}
