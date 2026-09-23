/* ---------------------------------------------------------------------------
   Antes era middleware.ts.
   ---------------------------------------------------------------------------
   Next 16 deprecó el nombre "middleware" y lo renombró a "proxy" (mismo
   comportamiento, solo cambia el archivo y el nombre de la función exportada;
   ver node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
   Se migró al añadirle las redirecciones de la mudanza a Facturas, para no
   dejar código nuevo sobre una convención ya deprecada.
--------------------------------------------------------------------------- */

import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "factubox_session";
const EMISOR_COOKIE = "factubox_emisor";
// /f/{codigo} es la autofactura por QR: el comprador llega desde el ticket o
// el correo y no tiene (ni debe necesitar) una cuenta de Factubox.
const PUBLIC_PATHS = ["/login", "/f"];

const ANIO = 365 * 24 * 60 * 60;

/**
 * Lo que se mudó de Emisores a Facturas.
 *
 * Nómina, timbrado masivo y autofacturas no configuran nada: emiten
 * comprobantes, y por eso viven ahora bajo /facturas. Estas redirecciones
 * existen para los marcadores y los enlaces viejos, y de paso dejan activo el
 * emisor que traía la URL — si no, quien pegue un enlace guardado acabaría
 * mirando los lotes de otro emisor sin darse cuenta.
 */
const MUDANZAS: Array<[RegExp, (resto: string) => string]> = [
  [/^\/emisores\/[^/]+\/masivo(\/.*)?$/, () => "/facturas/lotes"],
  [/^\/emisores\/[^/]+\/nomina(\/.*)?$/, (resto) => `/facturas/nomina${resto}`],
  [/^\/emisores\/[^/]+\/autofacturas(\/.*)?$/, (resto) => `/facturas/autofacturas${resto}`],
];

/** El rfc de /emisores/<rfc>/..., o null. */
function rfcDePathname(pathname: string): string | null {
  const m = /^\/emisores\/([^/]+)/.exec(pathname);
  if (!m || m[1] === "nuevo") return null;
  try {
    return decodeURIComponent(m[1]);
  } catch {
    return null;
  }
}

function ponerEmisor(res: NextResponse, rfc: string) {
  res.cookies.set(EMISOR_COOKIE, rfc, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ANIO,
  });
  return res;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value);

  // Con sesion o sin ella, la pagina publica se muestra igual: no redirige
  // al inicio como /login, porque quien la abre no viene a usar el app.
  if (!isPublic && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname === "/login" && hasSessionCookie) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const rfc = rfcDePathname(pathname);

  // Las tres secciones que se mudaron: redirigir y dejar su emisor activo.
  if (rfc) {
    for (const [patron, destino] of MUDANZAS) {
      const m = patron.exec(pathname);
      if (!m) continue;
      const url = request.nextUrl.clone();
      url.pathname = destino(m[1] ?? "");
      return ponerEmisor(NextResponse.redirect(url), rfc);
    }
  }

  // Dentro de /emisores/<rfc> manda la URL, no la cookie: si entras por un
  // enlace a la ficha de un emisor, la barra tiene que seguirte hasta ahí. Es
  // la única regla de precedencia entre los dos, y conviene que siga siendo la
  // única.
  if (rfc && request.cookies.get(EMISOR_COOKIE)?.value !== rfc) {
    return ponerEmisor(NextResponse.next(), rfc);
  }

  return NextResponse.next();
}

export const config = {
  // El "\\..*" excluye cualquier ruta con extension (imagenes, css, etc.)
  // servida desde /public - sin esto, el middleware las interceptaba y
  // las redirigia a /login como si fueran paginas.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*|favicon.ico).*)"],
};
