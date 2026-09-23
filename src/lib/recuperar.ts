import { NextResponse } from "next/server";
import { callPhpApi } from "@/lib/phpApi";

/**
 * "Olvidé mi contraseña": piezas compartidas por las rutas de
 * /api/auth/recuperar/*.
 *
 * El token del movimiento (el que emite recuperarSolicitarWeb.php) nunca llega
 * al navegador. Vive en una cookie httpOnly limitada a estas rutas: el
 * cliente solo manda el correo, el código y la contraseña nueva.
 */
export const COOKIE_RECUPERAR = "factubox_recuperar";

// Algo más que los 10 minutos del código, para que el aviso de "venció" lo
// dé el PHP con su mensaje y no una cookie que desapareció.
const COOKIE_MINUTOS = 15;

export function guardarTokenRecuperar(res: NextResponse, token: string) {
  res.cookies.set(COOKIE_RECUPERAR, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/recuperar",
    maxAge: COOKIE_MINUTOS * 60,
  });
}

export function borrarTokenRecuperar(res: NextResponse) {
  res.cookies.set(COOKIE_RECUPERAR, "", {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/api/auth/recuperar",
    maxAge: 0,
  });
}

/** Lo que el PHP agrega a sus errores en este flujo. */
type ErrorPhp = {
  Error: "1";
  DescripError: string;
  ErrorCode?: string;
  Campos?: Record<string, string>;
  IntentosRestantes?: number;
  SegundosRestantes?: number;
};

export type RespuestaRecuperar<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; body: Record<string, unknown> };

/**
 * Llama al endpoint y deja listo el cuerpo de error para el cliente:
 * { error, codigo?, campos?, intentosRestantes?, segundosRestantes? }.
 *
 * callPhpApi no expone el status HTTP del PHP, así que se reconstruye del
 * ErrorCode, que es lo que distingue los casos.
 */
export async function llamarRecuperar<T>(
  path: string,
  body: Record<string, string>
): Promise<RespuestaRecuperar<T>> {
  let resp;
  try {
    resp = await callPhpApi<T>(path, body);
  } catch {
    return {
      ok: false,
      status: 502,
      body: { error: "No se pudo conectar con el servidor. Intenta de nuevo." },
    };
  }

  if (resp.Error === "0") {
    return { ok: true, data: resp as T };
  }

  const e = resp as ErrorPhp;
  const status =
    e.ErrorCode === "ESPERA" ? 429 : e.ErrorCode === "SIN_CUENTA" ? 404 : 400;

  return {
    ok: false,
    status,
    body: {
      error: e.DescripError,
      codigo: e.ErrorCode,
      campos: e.Campos,
      intentosRestantes: e.IntentosRestantes,
      segundosRestantes: e.SegundosRestantes,
    },
  };
}

/** Errores después de los cuales el token ya no sirve y hay que empezar otra vez. */
export const CODIGOS_TERMINALES = new Set([
  "TOKEN_INVALIDO",
  "TIPO_INCORRECTO",
  "YA_USADO",
  "EXPIRADO",
  "SIN_CUENTA",
]);
