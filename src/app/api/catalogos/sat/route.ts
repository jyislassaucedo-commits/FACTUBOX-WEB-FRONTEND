import { NextRequest, NextResponse } from "next/server";
import { buscarTablaSat, listarTablaSat } from "@/lib/cartaPorteCatalogos";

/**
 * Catálogos del SAT por tabla (los de carta porte y geografía):
 *   ?tabla=SAT_CCP_TIPOS_PERMISO           lista completa (catálogos chicos)
 *   ?tabla=SAT_CCP_ESTACIONES&q=manz&medio=02   búsqueda (catálogos grandes)
 * El servidor PHP solo acepta tablas de su lista blanca.
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const tabla = (sp.get("tabla") ?? "").toUpperCase();
  if (!/^SAT_[A-Z_]+$/.test(tabla)) return NextResponse.json({ error: "Catálogo inválido" }, { status: 400 });

  const q = sp.get("q");
  if (q !== null) {
    const resp = await buscarTablaSat(tabla, q, sp.get("medio") ?? undefined);
    if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
    return NextResponse.json({ resultados: resp.Resultados ?? [] });
  }
  const resp = await listarTablaSat(tabla);
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ resultados: resp.Filas ?? [] }, { headers: { "Cache-Control": "private, max-age=3600" } });
}
