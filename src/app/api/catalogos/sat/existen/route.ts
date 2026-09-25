import { NextRequest, NextResponse } from "next/server";
import { existenClavesSat } from "@/lib/cartaPorteCatalogos";

/**
 * Cuáles claves existen (y siguen vigentes) en varios catálogos del SAT a la
 * vez: la validación por tandas de la importación de mercancías.
 *   { claves: { SAT_CCP_PRODUCTOS_SERVICIOS: ["50202301", …] }, extra: { …: ["material_peligroso"] } }
 * → { existen: { SAT_CCP_PRODUCTOS_SERVICIOS: { "50202301": { id, texto, … } } } }
 */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    claves?: Record<string, string[]>;
    extra?: Record<string, string[]>;
  } | null;
  const claves = body?.claves;
  if (!claves || typeof claves !== "object") return NextResponse.json({ error: "Faltan las claves" }, { status: 400 });
  for (const [tabla, lista] of Object.entries(claves)) {
    if (!/^SAT_[A-Z_]+$/.test(tabla) || !Array.isArray(lista)) {
      return NextResponse.json({ error: `Catálogo inválido: ${tabla}` }, { status: 400 });
    }
  }
  const resp = await existenClavesSat(claves, body?.extra ?? {});
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ existen: resp.Existen ?? {} });
}
