import { NextRequest, NextResponse } from "next/server";
import { setRfcActivo, TODOS } from "@/lib/emisorActivo";
import { getEmisores } from "@/lib/emisores";

/**
 * Cambia el emisor activo.
 *
 * Existe como ruta y no como Server Action porque el proyecto no usa ninguna:
 * todo lo que muta pasa por /api. Escribir la cookie desde un Server Component
 * no es posible en Next.
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as { rfc?: unknown } | null;
  const rfc = typeof body?.rfc === "string" ? body.rfc : null;

  if (rfc === null) {
    return NextResponse.json({ error: "Falta el rfc" }, { status: 400 });
  }

  // Se comprueba contra la lista del usuario: la cookie no es un secreto y
  // aceptarla a ciegas dejaría al cliente pedir datos de un emisor ajeno. El
  // backend valida de nuevo en cada llamada, pero no hay motivo para apoyarse
  // solo en eso.
  if (rfc !== TODOS) {
    const emisores = await getEmisores();
    if (!emisores.some((e) => e.Rfc === rfc)) {
      return NextResponse.json({ error: "Ese emisor no es tuyo" }, { status: 403 });
    }
  }

  await setRfcActivo(rfc);
  return NextResponse.json({ rfc });
}
