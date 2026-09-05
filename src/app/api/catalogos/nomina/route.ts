import { NextResponse } from "next/server";
import { getCatalogosNomina } from "@/lib/catalogosNomina";

/** Los catorce catalogos del complemento de nomina, para el formulario de
 *  empleado. Se piden juntos: de uno en uno serian catorce vueltas para
 *  pintar una sola pantalla. */
export async function GET() {
  try {
    const catalogos = await getCatalogosNomina();
    return NextResponse.json({ catalogos });
  } catch (e) {
    console.error("[catalogos/nomina]", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
