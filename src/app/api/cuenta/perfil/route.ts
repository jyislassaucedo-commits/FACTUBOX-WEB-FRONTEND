import { NextRequest, NextResponse } from "next/server";
import { editarPerfil, type PerfilCambios } from "@/lib/perfil";

/**
 * Datos generales de la cuenta con sesión abierta.
 *
 * No hay GET: la pantalla se renderiza en el servidor con getPerfil() y
 * después de mutar llama a router.refresh(), igual que las secciones de
 * emisor. Así no hay dos fuentes de verdad para lo mismo.
 */
export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  const cambios: PerfilCambios = {};

  if (typeof body.nombre === "string") cambios.Nombre = body.nombre.trim();
  if (typeof body.rfc === "string") cambios.Rfc = body.rfc.trim().toUpperCase();
  if (typeof body.usuario === "string") cambios.Usuario = body.usuario.trim();
  if (body.sincronizar === "SI" || body.sincronizar === "NO") {
    cambios.Sincronizar = body.sincronizar;
  }

  if (Object.keys(cambios).length === 0) {
    return NextResponse.json({ error: "No hay nada que actualizar" }, { status: 400 });
  }

  const resultado = await editarPerfil(cambios);

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, campos: resultado.campos },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
