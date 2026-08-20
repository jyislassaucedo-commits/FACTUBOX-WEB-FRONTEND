import { NextRequest, NextResponse } from "next/server";
import { getUltimoFolio } from "@/lib/series";

export async function GET(request: NextRequest) {
  const rfc = request.nextUrl.searchParams.get("rfc");
  const serie = request.nextUrl.searchParams.get("serie");

  if (!rfc || !serie) {
    return NextResponse.json({ error: "Faltan rfc o serie" }, { status: 400 });
  }

  const ultimoFolio = await getUltimoFolio(rfc, serie);
  return NextResponse.json({ ultimoFolio });
}
