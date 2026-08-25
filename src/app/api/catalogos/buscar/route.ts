import { NextRequest, NextResponse } from "next/server";
import { buscarCatalogoSat, type CatalogoBuscable } from "@/lib/catalogoSatBusqueda";

const CATALOGOS_VALIDOS: CatalogoBuscable[] = [
  "productoServicio",
  "productoServicioCartaPorte",
  "claveUnidad",
];

/** Autocompletado de claves del SAT (producto/servicio, unidad) para Conceptos. */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const catalogo = sp.get("catalogo") as CatalogoBuscable | null;
  const q = sp.get("q") ?? "";

  if (!catalogo || !CATALOGOS_VALIDOS.includes(catalogo)) {
    return NextResponse.json({ error: "Catálogo no reconocido" }, { status: 400 });
  }

  try {
    const resultados = await buscarCatalogoSat(catalogo, q);
    return NextResponse.json({ resultados });
  } catch (e) {
    console.error("[catalogos/buscar]", e);
    return NextResponse.json(
      { resultados: [], error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
