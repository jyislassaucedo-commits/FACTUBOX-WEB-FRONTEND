import { callPhpApi } from "./phpApi";
import { getSession } from "./session";

export type CurrentUser = {
  IdUser: number;
  Rfc: string;
  Email: string;
  Usuario: string;
  Nombre: string;
  Tipo: string;
  EsSubusuario: "SI" | "NO";
  /**
   * Ruta de la foto en el sitio PHP ("/img/usuarios/..."), null si no tiene.
   * Viene en authMeWeb para que el avatar del encabezado no cueste una
   * llamada extra en cada pantalla.
   */
  ImagenUrl: string | null;
  /**
   * IMEI de la licencia de la cuenta, null si no tiene una registrada.
   *
   * Es el mismo que muestra la app de escritorio al iniciar sesion: sirve para
   * que el usuario lo dicte a soporte sin abrir la otra aplicacion. Para un
   * subusuario es el de su titular, porque la licencia es de la cuenta.
   *
   * Viaja en authMeWeb por la misma razon que ImagenUrl: el encabezado ya
   * llamaba a ese endpoint en cada pantalla, asi que no cuesta una peticion
   * extra. Es opcional en el tipo porque una respuesta de un PHP todavia sin
   * actualizar no trae el campo.
   */
  Imei?: string | null;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const session = await getSession();
  if (!session) return null;

  const resp = await callPhpApi<CurrentUser>("/endpoint/web/authMeWeb.php", {
    SessionToken: session.token,
  });

  if (resp.Error !== "0") {
    // No se limpia la cookie aqui: esta funcion tambien se llama desde
    // Server Components, donde Next.js no permite mutar cookies. La
    // limpieza real ocurre en /api/auth/logout o cuando expira sola.
    return null;
  }

  return resp;
}
