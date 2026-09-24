import { NextRequest, NextResponse } from "next/server";
import { borrarRegistroCP, obtenerRegistroCP } from "@/lib/cartaPorteCatalogos";
import { esEntidadCP } from "@/lib/cartaPorteShared";

type Ctx = { params: Promise<{ rfc: string; entidad: string; id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const { rfc, entidad, id } = await params;
  if (!esEntidadCP(entidad) || !(Number(id) > 0)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const resp = await obtenerRegistroCP(decodeURIComponent(rfc), entidad, Number(id));
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 404 });
  return NextResponse.json({ registro: resp.Registro });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { rfc, entidad, id } = await params;
  if (!esEntidadCP(entidad) || !(Number(id) > 0)) return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  const resp = await borrarRegistroCP(decodeURIComponent(rfc), entidad, Number(id));
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ ok: true });
}
