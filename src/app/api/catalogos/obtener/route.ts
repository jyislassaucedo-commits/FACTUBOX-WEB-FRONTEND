import { NextRequest, NextResponse } from "next/server";
import { obtenerCatalogoSat } from "@/lib/catalogoSatBusqueda";
import type { CatalogoCompleto } from "@/lib/catalogoSatBusquedaShared";

const CATALOGOS_VALIDOS: CatalogoCompleto[] = ["regimenFiscal", "usoCfdi"];

/** Catálogo completo (RegimenFiscal, UsoCFDI) para autocompletar en el cliente. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogo = sp.get("catalogo") as CatalogoCompleto | null;

  if (!catalogo || !CATALOGOS_VALIDOS.includes(catalogo)) {
    return NextResponse.json({ error: "Catálogo no reconocido" }, { status: 400 });
  }

  try {
    const resultados = await obtenerCatalogoSat(catalogo);
    return NextResponse.json({ resultados });
  } catch (e) {
    console.error("[catalogos/obtener]", e);
    return NextResponse.json(
      { resultados: [], error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
