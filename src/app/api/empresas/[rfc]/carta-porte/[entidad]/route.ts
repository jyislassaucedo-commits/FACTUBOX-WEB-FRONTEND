import { NextRequest, NextResponse } from "next/server";
import { guardarRegistroCP, listarCatalogoCP } from "@/lib/cartaPorteCatalogos";
import { esEntidadCP, type RegistroCP } from "@/lib/cartaPorteShared";

type Ctx = { params: Promise<{ rfc: string; entidad: string }> };

/** Una página de un catálogo de carta porte: ?q=&pagina=&por= */
export async function GET(request: NextRequest, { params }: Ctx) {
  const { rfc, entidad } = await params;
  if (!esEntidadCP(entidad)) return NextResponse.json({ error: "Catálogo desconocido" }, { status: 404 });
  const sp = request.nextUrl.searchParams;
  const pagina = await listarCatalogoCP(decodeURIComponent(rfc), entidad, {
    q: sp.get("q") ?? "",
    pagina: Number(sp.get("pagina") ?? 1) || 1,
    por: Number(sp.get("por") ?? 50) || 50,
  });
  if (!pagina) return NextResponse.json({ error: "No se pudo consultar el catálogo" }, { status: 502 });
  return NextResponse.json(pagina);
}

/** Crea (sin id) o reemplaza (con id) un registro con todo su árbol. */
export async function POST(request: NextRequest, { params }: Ctx) {
  const { rfc, entidad } = await params;
  if (!esEntidadCP(entidad)) return NextResponse.json({ error: "Catálogo desconocido" }, { status: 404 });
  const body = (await request.json().catch(() => null)) as RegistroCP | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Faltan los datos" }, { status: 400 });
  const resp = await guardarRegistroCP(decodeURIComponent(rfc), entidad, body);
  if (resp.Error !== "0") return NextResponse.json({ error: resp.DescripError }, { status: 400 });
  return NextResponse.json({ id: resp.Id, registro: resp.Registro });
}
