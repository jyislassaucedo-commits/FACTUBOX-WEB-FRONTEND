import { NextRequest, NextResponse } from "next/server";
import { repetirPeriodo } from "@/lib/nomina";

/**
 * Crea la corrida del periodo siguiente con la misma gente.
 *
 * Con `previsualizar` sólo responde qué haría: fechas propuestas, a cuántos
 * alcanza y quién se dio de baja en el camino. No crea nada.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string; id: string }> }
) {
  const { rfc, id } = await params;
  const body = (await request.json().catch(() => null)) as {
    copiarFijas?: boolean;
    previsualizar?: boolean;
  } | null;

  const resp = await repetirPeriodo(decodeURIComponent(rfc), id, {
    copiarFijas: body?.copiarFijas,
    previsualizar: body?.previsualizar,
  });

  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }

  return NextResponse.json({
    id: resp.Id ?? null,
    periodo: resp.Periodo,
    empleados: resp.Empleados,
    bajas: resp.Bajas ?? [],
    fijas: resp.Fijas ?? 0,
    fijasCopiadas: resp.FijasCopiadas ?? 0,
    calculados: resp.Calculados ?? [],
    omitidos: resp.Omitidos ?? [],
    avisos: resp.Avisos ?? [],
  });
}
