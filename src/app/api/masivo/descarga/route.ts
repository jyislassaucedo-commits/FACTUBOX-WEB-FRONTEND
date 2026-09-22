import { NextRequest, NextResponse } from "next/server";
import { descargaLote } from "@/lib/masivo";

/**
 * El reporte de resultados o el paquete de comprobantes.
 *
 * El PHP los devuelve en base64 y aquí se convierten a bytes: así el navegador
 * recibe un archivo normal y no tiene que decodificar nada.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    rfc?: string;
    idLote?: number;
    que?: "REPORTE" | "PAQUETE";
    incluirPdf?: boolean;
  } | null;

  if (!body?.rfc || !body?.idLote || !body?.que) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const res = await descargaLote(body.rfc, body.idLote, body.que, body.incluirPdf === true);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const bytes = Buffer.from(res.Archivo_Base64, "base64");
  const tipo =
    body.que === "REPORTE"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/zip";

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": tipo,
      "Content-Disposition": `attachment; filename="${res.NombreArchivo}"`,
    },
  });
}
