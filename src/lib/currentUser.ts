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
