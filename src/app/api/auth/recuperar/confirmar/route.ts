import { NextRequest, NextResponse } from "next/server";
import {
  borrarTokenRecuperar,
  CODIGOS_TERMINALES,
  COOKIE_RECUPERAR,
  llamarRecuperar,
} from "@/lib/recuperar";

/** Paso 2: verifica el código de 6 dígitos. No gasta el token. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";
  const token = request.cookies.get(COOKIE_RECUPERAR)?.value ?? "";

  if (!token) {
    return NextResponse.json(
      { error: "La solicitud venció. Pide un código nuevo.", codigo: "TOKEN_INVALIDO" },
      { status: 400 }
    );
  }
  if (!/^\d{6}$/.test(codigo)) {
    return NextResponse.json(
      { error: "El código tiene 6 dígitos", campos: { Codigo: "El código tiene 6 dígitos" } },
      { status: 400 }
    );
  }

  const r = await llamarRecuperar("/endpoint/web/recuperarConfirmarWeb.php", {
    Token: token,
    Codigo: codigo,
  });

  if (!r.ok) {
    const res = NextResponse.json(r.body, { status: r.status });
    if (CODIGOS_TERMINALES.has(String(r.body.codigo))) borrarTokenRecuperar(res);
    return res;
  }

  return NextResponse.json({ ok: true });
}
