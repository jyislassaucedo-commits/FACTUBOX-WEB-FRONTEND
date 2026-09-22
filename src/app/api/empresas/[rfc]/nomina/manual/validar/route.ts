import { NextRequest, NextResponse } from "next/server";
import { validarNominaManual } from "@/lib/nominaManual";
import { normalizarForm } from "@/lib/nominaManualShared";

/**
 * Ensaya el timbrado sin timbrar: arma el CFDI de nómina y lo pasa por los
 * esquemas, catálogos y reglas del SAT. No consume timbres.
 *
 * 400 con `errores` cuando el formulario no se pudo ni armar (eso lo dice el
 * backend por campo); el veredicto del SAT viene en el cuerpo con 200.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ rfc: string }> }
) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as { emisorToken?: string; form?: unknown } | null;

  if (!body?.emisorToken || !body.form) {
    return NextResponse.json({ error: "Faltan emisorToken o form" }, { status: 400 });
  }

  const r = await validarNominaManual(decodeURIComponent(rfc), body.emisorToken, normalizarForm(body.form));
  if (!r.ok) {
    return NextResponse.json({ error: r.motivo, errores: r.errores ?? [] }, { status: 400 });
  }
  return NextResponse.json({ ...r.datos, serie: r.serie, folio: r.folio, avisos: r.avisos });
}
