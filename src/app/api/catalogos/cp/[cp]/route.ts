import { NextRequest, NextResponse } from "next/server";
import { consultarCodigoPostal } from "@/lib/cartaPorteCatalogos";

/** Estado, municipio, localidad y colonias de un código postal (para autollenar domicilios). */
export async function GET(_request: NextRequest, { params }: { params: Promise<{ cp: string }> }) {
  const { cp } = await params;
  if (!/^\d{5}$/.test(cp)) return NextResponse.json({ error: "El código postal son 5 dígitos" }, { status: 400 });
  const resp = await consultarCodigoPostal(cp);
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json(
    { codigoPostal: resp.CodigoPostal, colonias: resp.Colonias ?? [] },
    { headers: { "Cache-Control": "private, max-age=86400" } }
  );
}
