import { NextRequest, NextResponse } from "next/server";
import { guardarMercanciasCP } from "@/lib/cartaPorteCatalogos";

/**
 * Guarda una tanda de mercancías en el catálogo (hasta 1000), sin duplicar
 * las que ya existen con la misma clave, descripción y unidad. Lo usa la
 * importación de Excel con "Guardarlas también en el catálogo".
 *
 * Vive fuera de /carta-porte/[entidad] para no chocar con [entidad]/[id].
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ rfc: string }> }) {
  const { rfc } = await params;
  const body = (await request.json().catch(() => null)) as { filas?: Array<Record<string, string>> } | null;
  const filas = body?.filas;
  if (!Array.isArray(filas) || filas.length === 0) return NextResponse.json({ error: "Faltan las mercancías" }, { status: 400 });
  if (filas.length > 1000) return NextResponse.json({ error: "Hasta 1000 mercancías por tanda" }, { status: 400 });
  const resp = await guardarMercanciasCP(decodeURIComponent(rfc), filas);
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ recibidas: resp.Recibidas, nuevas: resp.Nuevas });
}
