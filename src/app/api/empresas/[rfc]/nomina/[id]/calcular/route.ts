import { NextRequest, NextResponse } from "next/server";
import { calcularNomina } from "@/lib/nomina";

/** Corre la nómina del periodo. No timbra ni cuesta timbres. */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const resp = await calcularNomina(decodeURIComponent(rfc), id);
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({
    empleados: resp.Empleados,
    calculados: resp.Calculados,
    omitidos: resp.Omitidos,
    avisos: resp.Avisos,
    nota: resp.Nota,
    recibos: resp.Recibos,
  });
}
