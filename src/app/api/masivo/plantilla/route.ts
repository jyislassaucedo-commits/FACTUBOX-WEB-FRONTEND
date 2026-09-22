import { NextRequest, NextResponse } from "next/server";
import { plantillaVacia } from "@/lib/masivo";

/**
 * Entrega la plantilla vacía que sirve el servidor.
 *
 * Se pide al backend en vez de guardarla aquí para que la web y las demás
 * aplicaciones ofrezcan exactamente el mismo archivo: una copia propia se
 * desincroniza en cuanto cambia una columna.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    rfc?: string;
    tipo?: string;
    layout?: string;
  } | null;

  if (!body?.rfc || !body?.tipo || !body?.layout) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 });
  }

  const res = await plantillaVacia(body.rfc, body.tipo, body.layout);
  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }

  const bytes = Buffer.from(res.Archivo_Base64, "base64");
  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${res.NombreArchivo}"`,
    },
  });
}
