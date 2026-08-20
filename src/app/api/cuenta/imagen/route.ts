import { NextRequest, NextResponse } from "next/server";
import { eliminarImagenPerfil, subirImagenPerfil } from "@/lib/perfil";
import { fetchPhpAsset } from "@/lib/phpApi";
import { esRutaImagenPerfil } from "@/lib/perfilShared";

const MAX_BYTES = 3 * 1024 * 1024;
const TIPOS = ["image/jpeg", "image/png", "image/webp"];

/**
 * Proxy de lectura: el navegador pide /api/cuenta/imagen?src=/img/usuarios/x.jpg
 * y el BFF trae los bytes del host PHP.
 *
 * Se hace así para no publicar PHP_API_BASE_URL en el bundle del cliente ni
 * tener que declarar remotePatterns. La ruta se valida contra una lista
 * blanca estricta: sin ella esto sería un SSRF hacia cualquier ruta del host.
 */
export async function GET(request: NextRequest) {
  const src = request.nextUrl.searchParams.get("src") ?? "";

  if (!esRutaImagenPerfil(src)) {
    return new NextResponse(null, { status: 400 });
  }

  const upstream = await fetchPhpAsset(src).catch(() => null);

  if (!upstream || !upstream.ok) {
    return new NextResponse(null, { status: 404 });
  }

  const tipo = upstream.headers.get("content-type") ?? "";
  if (!TIPOS.some((t) => tipo.startsWith(t))) {
    return new NextResponse(null, { status: 415 });
  }

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": tipo,
      // El nombre del archivo lleva un sufijo aleatorio que cambia con cada
      // foto nueva, así que la URL es inmutable y se puede cachear fuerte.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}

/** Sube o reemplaza la foto. */
export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const imagen = form?.get("imagen");

  if (!(imagen instanceof File)) {
    return NextResponse.json({ error: "No se recibió ninguna imagen" }, { status: 400 });
  }

  // Filtro barato del lado del BFF para no gastar un viaje al PHP con un
  // archivo obviamente inválido. El PHP vuelve a validar por contenido.
  if (imagen.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede pasar de 3 MB" }, { status: 400 });
  }
  if (imagen.type && !TIPOS.includes(imagen.type)) {
    return NextResponse.json(
      { error: "Formato no soportado. Usa JPG, PNG o WEBP" },
      { status: 400 }
    );
  }

  const resultado = await subirImagenPerfil(imagen);

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, imagenUrl: resultado.data.ImagenUrl });
}

/** Quita la foto y vuelve a las iniciales. */
export async function DELETE() {
  const resultado = await eliminarImagenPerfil();

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  return NextResponse.json({ ok: true, imagenUrl: null });
}
