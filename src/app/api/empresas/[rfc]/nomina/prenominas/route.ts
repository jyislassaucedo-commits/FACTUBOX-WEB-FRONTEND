import { NextRequest, NextResponse } from "next/server";
import { getPrenominas, savePrenomina } from "@/lib/nominaManual";
import { normalizarForm } from "@/lib/nominaManualShared";

/** Las prenóminas del emisor (opcionalmente solo las de un empleado). */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const idEmpleado = request.nextUrl.searchParams.get("idEmpleado") ?? undefined;
  const prenominas = await getPrenominas(decodeURIComponent(rfc), idEmpleado);
  return NextResponse.json({ prenominas });
}

/** Guarda una prenómina nueva. Puede ir a medias: el backend la acepta y
 *  devuelve lo que falta para poder timbrarla. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as { nombre?: string; form?: unknown } | null;

  if (!body?.nombre?.trim() || !body.form) {
    return NextResponse.json({ error: "Faltan nombre o form" }, { status: 400 });
  }

  const resp = await savePrenomina(decodeURIComponent(rfc), body.nombre.trim(), normalizarForm(body.form));
  if (resp.Error !== "0") {
    return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    id: resp.Id,
    prenomina: resp.Prenomina,
    errores: resp.Errores ?? [],
    avisos: resp.Avisos ?? [],
  });
}
