import { NextRequest, NextResponse } from "next/server";
import { cambiarPassword } from "@/lib/perfil";
import { getSession, setSession } from "@/lib/session";

/**
 * Cambio de contraseña.
 *
 * El endpoint PHP revoca TODAS las sesiones de la cuenta y emite una nueva
 * para este dispositivo. Hay que escribir ese token en la cookie de inmediato
 * o el propio usuario que acaba de cambiar su contraseña se queda fuera en la
 * siguiente petición.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const actual = typeof body?.actual === "string" ? body.actual : "";
  const nueva = typeof body?.nueva === "string" ? body.nueva : "";

  if (!actual || !nueva) {
    return NextResponse.json(
      { error: "Captura tu contraseña actual y la nueva" },
      { status: 400 }
    );
  }

  const sesionPrevia = await getSession();
  if (!sesionPrevia) {
    return NextResponse.json({ error: "Tu sesión expiró" }, { status: 401 });
  }

  const resultado = await cambiarPassword(actual, nueva);

  if (!resultado.ok) {
    return NextResponse.json(
      { error: resultado.error, campos: resultado.campos },
      { status: 400 }
    );
  }

  await setSession(
    { token: resultado.data.Token, deviceId: resultado.data.DeviceId },
    resultado.data.ExpiraEnDias
  );

  return NextResponse.json({
    ok: true,
    mensaje: "Contraseña actualizada. Se cerraron las demás sesiones.",
  });
}
