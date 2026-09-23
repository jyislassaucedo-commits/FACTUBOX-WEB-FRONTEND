import { cookies } from "next/headers";
import type { Emisor } from "@/lib/emisores";

/* ---------------------------------------------------------------------------
   El emisor activo.
   ---------------------------------------------------------------------------
   Antes el emisor vivía en la dirección: /emisores/<rfc>/nomina, /masivo, etc.
   Eso ataba "con quién facturo" a "en qué pantalla estoy", y obligaba a que todo
   lo que emite comprobantes colgara de Emisores aunque no fuera configuración.

   Ahora vive en una cookie y se elige en la barra superior, como en la
   aplicación de escritorio. Las pantallas de Facturas lo leen de aquí; las de
   /emisores/<rfc> siguen tomándolo de la URL (ver la nota de precedencia abajo).

   Mismo mecanismo que la sesión (lib/session.ts): cookie leída por Server
   Components y escrita desde un Route Handler. No hace falta estado de cliente
   ni una librería: lo que consume el rfc son componentes de servidor.
--------------------------------------------------------------------------- */

const EMISOR_COOKIE = "factubox_emisor";

/** Un año: es una preferencia, no una credencial. */
const DIAS = 365;

/**
 * "Todos los emisores" es un valor legítimo, no un fallo.
 *
 * Inicio y la lista de Facturas funcionan agregados y así los usa quien lleva
 * varios emisores. Lo que NO funciona con "todos" es emitir: un CFDI sale de un
 * emisor concreto, y esas pantallas piden elegir uno (avisoElegirEmisor).
 */
export const TODOS = "";

/** Lo que hay en la cookie, sin interpretar. */
export async function getRfcCookie(): Promise<string> {
  const store = await cookies();
  return store.get(EMISOR_COOKIE)?.value ?? TODOS;
}

/**
 * El rfc activo de verdad: la cookie, si sigue siendo un emisor del usuario.
 *
 * Se valida contra la lista porque la cookie sobrevive a que le quiten acceso a
 * un emisor, o a que lo borren. Sin esto, el usuario se quedaría mirando una
 * pantalla vacía sin entender por qué.
 *
 * Con un solo emisor no se pregunta nada: se usa ese. Elegir entre uno es una
 * decisión que no existe.
 */
export async function resolverRfcActivo(emisores: Emisor[]): Promise<string> {
  const guardado = await getRfcCookie();
  if (guardado !== TODOS && emisores.some((e) => e.Rfc === guardado)) {
    return guardado;
  }
  if (emisores.length === 1) return emisores[0].Rfc;
  return TODOS;
}

/** El emisor activo completo, o null si está en "todos" (o no lo encuentra). */
export async function getEmisorActivo(emisores: Emisor[]): Promise<Emisor | null> {
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return null;
  return emisores.find((e) => e.Rfc === rfc) ?? null;
}

/**
 * Escribe la cookie. Solo se puede llamar desde un Route Handler: Next.js no
 * deja mutar cookies desde un Server Component (mismo motivo que en
 * currentUser.ts).
 */
export async function setRfcActivo(rfc: string) {
  const store = await cookies();
  store.set(EMISOR_COOKIE, rfc, {
    // Sin httpOnly a propósito: no es un secreto y el middleware la lee para
    // decidir a qué emisor mandar una URL vieja.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: DIAS * 24 * 60 * 60,
  });
}

/** El nombre de la cookie, para el middleware. */
export const COOKIE_EMISOR = EMISOR_COOKIE;
