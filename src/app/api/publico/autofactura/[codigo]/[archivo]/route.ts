import { NextRequest, NextResponse } from "next/server";
import { descargarArchivoAutofactura, type ArchivoAutofactura } from "@/lib/autofactura";

const ARCHIVOS: ArchivoAutofactura[] = ["pdf", "xml", "qr"];

/**
 * /api/publico/autofactura/{codigo}/pdf | xml | qr
 *
 * Reenvía los bytes tal cual (tipo y nombre de archivo incluidos) desde el
 * PHP. El QR se puede cachear largo: el código nunca cambia.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ codigo: string; archivo: string }> }
) {
  const { codigo, archivo } = await params;
  if (!ARCHIVOS.includes(archivo as ArchivoAutofactura)) {
    return NextResponse.json({ error: "Archivo no reconocido" }, { status: 404 });
  }

  const upstream = await descargarArchivoAutofactura(codigo, archivo as ArchivoAutofactura);
  if (!upstream) {
    return NextResponse.json({ error: "Este enlace no corresponde a ninguna venta" }, { status: 404 });
  }
  if (!upstream.ok) {
    // El PHP contesta los errores en JSON; se pasa el mensaje con su código.
    const body = await upstream.json().catch(() => ({ DescripError: "No se pudo obtener el archivo" }));
    return NextResponse.json({ error: body.DescripError ?? "No se pudo obtener el archivo" }, { status: upstream.status });
  }

  const headers = new Headers();
  headers.set("Content-Type", upstream.headers.get("content-type") ?? "application/octet-stream");
  const disposicion = upstream.headers.get("content-disposition");
  if (disposicion) headers.set("Content-Disposition", disposicion);
  headers.set(
    "Cache-Control",
    archivo === "qr" ? "public, max-age=31536000, immutable" : "private, max-age=0"
  );

  return new NextResponse(await upstream.arrayBuffer(), { status: 200, headers });
}
