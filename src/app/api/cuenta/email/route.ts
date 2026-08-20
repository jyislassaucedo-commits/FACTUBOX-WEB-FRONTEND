import { NextRequest, NextResponse } from "next/server";
import { confirmarCambioEmail, solicitarCambioEmail } from "@/lib/perfil";

/**
 * Cambio de correo, dos pasos:
 *
 *   POST → pide el código y lo manda al correo NUEVO (requiere contraseña)
 *   PUT  → confirma el código y aplica el cambio
 *
 * El token del movimiento sale del paso 1 y vuelve en el paso 2. Es opaco
 * para el cliente y el correo final nunca viaja en el paso 2: lo recupera el
 * PHP del propio movimiento.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json(
      { error: "Captura el nuevo correo y tu contraseña" },
      { status: 400 }
    );
  }

  const resultado = await solicitarCambioEmail(email, password);

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, campos: resultado.campos },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    token: resultado.data.Token,
    email: resultado.data.EmailNuevo,
    expiraEnMinutos: resultado.data.ExpiraEnMinutos,
  });
}

export async function PUT(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const token = typeof body?.token === "string" ? body.token : "";
  const codigo = typeof body?.codigo === "string" ? body.codigo.trim() : "";

  if (!token || !codigo) {
    return NextResponse.json(
      { error: "Captura el código que te llegó por correo" },
      { status: 400 }
    );
  }

  const resultado = await confirmarCambioEmail(token, codigo);

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, campos: resultado.campos },
      { status: 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    email: resultado.data.Email,
    usuario: resultado.data.Usuario,
  });
}
