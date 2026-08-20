import { NextRequest, NextResponse } from "next/server";
import { getFacturas } from "@/lib/facturas";

const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Búsqueda de facturas para el cliente.
 *
 * La pantalla de listado carga sus datos en el servidor, pero el modal que
 * relaciona una nota de crédito con su factura original necesita consultar
 * desde el navegador. Misma capa de datos, mismos límites: el rango de fechas
 * es lo que acota (ver src/lib/facturas.ts).
 */
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;

  const desde = sp.get("desde") ?? "";
  const hasta = sp.get("hasta") ?? "";
  if (!ES_FECHA.test(desde) || !ES_FECHA.test(hasta)) {
    return NextResponse.json({ error: "Rango de fechas inválido" }, { status: 400 });
  }

  const facturas = await getFacturas({
    emisor: sp.get("emisor") ?? "",
    tipo: sp.get("tipo") ?? "TODO",
    estatus: sp.get("estatus") ?? "TODO",
    desde,
    hasta,
  });

  return NextResponse.json({ facturas });
}
