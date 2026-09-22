import { NextRequest, NextResponse } from "next/server";
import { crearLoteDesdeArchivo } from "@/lib/masivo";

/**
 * Sube la plantilla y crea el lote.
 *
 * El archivo se reenvía tal cual al PHP, que es quien lo interpreta. Aquí no se
 * lee: tener dos lectores de plantillas -- uno en Node y otro en PHP -- sería
 * garantizar que algún día no coincidan.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  if (!form) {
    return NextResponse.json({ error: "No se recibió el formulario" }, { status: 400 });
  }

  const archivo = form.get("archivo");
  const rfc = String(form.get("rfc") ?? "");
  if (!(archivo instanceof File) || archivo.size === 0) {
    return NextResponse.json({ error: "Elige un archivo" }, { status: 400 });
  }
  if (!rfc) {
    return NextResponse.json({ error: "Falta el emisor" }, { status: 400 });
  }

  const res = await crearLoteDesdeArchivo({
    rfc,
    archivo,
    modoTimbrado: form.get("modo") === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS",
    serie: String(form.get("serie") ?? "") || undefined,
    referencia: String(form.get("referencia") ?? "") || undefined,
    enviarCorreo: form.get("enviarCorreo") === "1",
    claveIdempotencia: String(form.get("clave") ?? "") || undefined,
  });

  if ("error" in res) {
    return NextResponse.json({ error: res.error }, { status: 400 });
  }
  return NextResponse.json({ lote: res });
}
