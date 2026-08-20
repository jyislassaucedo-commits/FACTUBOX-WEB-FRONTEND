import { NextRequest, NextResponse } from "next/server";
import { getDashboardData } from "@/lib/reportes";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rfc = params.get("rfc") ?? "";
  const tipo = params.get("tipo") ?? "TODO";
  const mes = params.get("mes") ?? "";
  const anioParam = params.get("anio");
  const anio = anioParam ? parseInt(anioParam, 10) : new Date().getFullYear();

  const data = await getDashboardData({ rfc, anio, mes, tipo });

  if (!data) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  return NextResponse.json(data);
}
