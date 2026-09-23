import { NextRequest, NextResponse } from "next/server";
import {
  borrarTokenRecuperar,
  CODIGOS_TERMINALES,
  COOKIE_RECUPERAR,
  llamarRecuperar,
} from "@/lib/recuperar";

/**
 * Paso 3: guarda la contraseña nueva. El PHP cierra todas las sesiones de la
 * cuenta y avisa por correo; aquí no se inicia sesión, el usuario vuelve al
 * login.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === "string" ? body.password : "";
  const token = request.cookies.get(COOKIE_RECUPERAR)?.value ?? "";

  if (!token) {
    return NextResponse.json(
      { error: "La solicitud venció. Pide un código nuevo.", codigo: "TOKEN_INVALIDO" },
      { status: 400 }
    );
  }

  const r = await llamarRecuperar("/endpoint/web/recuperarRestablecerWeb.php", {
    Token: token,
    PasswordNueva: password,
  });

  if (!r.ok) {
    const res = NextResponse.json(r.body, { status: r.status });
    if (CODIGOS_TERMINALES.has(String(r.body.codigo))) borrarTokenRecuperar(res);
    return res;
  }

  const res = NextResponse.json({ ok: true });
  borrarTokenRecuperar(res);
  return res;
}
