import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "factubox_session";
// /f/{codigo} es la autofactura por QR: el comprador llega desde el ticket o
// el correo y no tiene (ni debe necesitar) una cuenta de Factubox.
const PUBLIC_PATHS = ["/login", "/f"];

export function middleware(request: NextRequest) {
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

  return NextResponse.next();
}

export const config = {
  // El "\\..*" excluye cualquier ruta con extension (imagenes, css, etc.)
  // servida desde /public - sin esto, el middleware las interceptaba y
  // las redirigia a /login como si fueran paginas.
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*|favicon.ico).*)"],
};
