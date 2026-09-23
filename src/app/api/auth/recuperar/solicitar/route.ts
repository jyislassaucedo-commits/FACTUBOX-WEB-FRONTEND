import { NextRequest, NextResponse } from "next/server";
import { guardarTokenRecuperar, llamarRecuperar } from "@/lib/recuperar";

type SolicitarPhp = {
  Token: string;
  ExpiraEnMinutos: number;
  EsperaSegundos: number;
};

/**
 * Paso 1: manda el código al correo.
 *
 * La respuesta es la misma tenga cuenta el correo o no (lo decide el PHP), así
 * que esta pantalla no sirve para averiguar quién es cliente.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!email) {
    return NextResponse.json(
      { error: "Escribe el correo de tu cuenta", campos: { Email: "Escribe el correo de tu cuenta" } },
      { status: 400 }
    );
  }

  const r = await llamarRecuperar<SolicitarPhp>(
    "/endpoint/web/recuperarSolicitarWeb.php",
    { Email: email }
  );

  if (!r.ok) {
    return NextResponse.json(r.body, { status: r.status });
  }

  const res = NextResponse.json({
    ok: true,
    expiraEnMinutos: r.data.ExpiraEnMinutos,
    esperaSegundos: r.data.EsperaSegundos,
  });
  guardarTokenRecuperar(res, r.data.Token);
  return res;
}
