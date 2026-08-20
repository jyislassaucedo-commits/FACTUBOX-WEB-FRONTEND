import { callPhpApi, callLegacyPhpApiFormData, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import type { CamposConError, Perfil } from "./perfilShared";

/* ---------------------------------------------------------------------------
   Mi cuenta: lectura y edicion de los datos de la cuenta con sesion abierta.
   ---------------------------------------------------------------------------
   Todo pasa por endpoint/web/, no por maa/mvc/.../api/. Esos endpoints
   resuelven USUARIO vs SUBUSUARIO desde el propio token y nunca reciben un id
   ni un correo del cliente, asi que la misma pantalla sirve para las dos
   clases de cuenta sin ramificar la seguridad aqui.

   Modulo de SERVIDOR: importa getSession() (next/headers). Lo que necesiten
   los componentes de cliente vive en perfilShared.ts.
--------------------------------------------------------------------------- */

export type ResultadoMutacion<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; campos?: CamposConError };

type RespuestaConCampos = { Campos?: CamposConError; ErrorCode?: string };

function fallo<T>(resp: PhpResponse<RespuestaConCampos>): ResultadoMutacion<T> {
  const conCampos = resp as unknown as RespuestaConCampos;
  return {
    ok: false,
    error:
      "DescripError" in resp
        ? resp.DescripError
        : "No se pudo completar la operación",
    campos: conCampos.Campos,
  };
}

const SIN_SESION = "Tu sesión expiró, vuelve a iniciar sesión";

/* -------------------------------------------------------------------------- */
/* Lectura                                                                    */
/* -------------------------------------------------------------------------- */

export async function getPerfil(): Promise<Perfil | null> {
  const session = await getSession();
  if (!session) return null;

  const resp = await callPhpApi<Perfil>("/endpoint/web/getPerfilWeb.php", {
    SessionToken: session.token,
  });

  if (resp.Error !== "0") return null;
  return resp;
}

/* -------------------------------------------------------------------------- */
/* Datos generales                                                            */
/* -------------------------------------------------------------------------- */

export type PerfilCambios = {
  Nombre?: string;
  Rfc?: string;
  Usuario?: string;
  Sincronizar?: "SI" | "NO";
};

export async function editarPerfil(
  cambios: PerfilCambios
): Promise<ResultadoMutacion<{ Nombre: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  // Solo se mandan los campos presentes: el endpoint aplica lo que llega y
  // deja intacto lo demás, así dos pestañas abiertas no se pisan entre sí.
  const body: Record<string, string> = { SessionToken: session.token };
  for (const [clave, valor] of Object.entries(cambios)) {
    if (valor !== undefined) body[clave] = valor;
  }

  const resp = await callPhpApi<{ Nombre: string }>(
    "/endpoint/web/editPerfilWeb.php",
    body
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}

/* -------------------------------------------------------------------------- */
/* Contraseña                                                                 */
/* -------------------------------------------------------------------------- */

export type PasswordActualizada = {
  Token: string;
  DeviceId: string;
  ExpiraEnDias: number;
  Descripcion: string;
};

export async function cambiarPassword(
  actual: string,
  nueva: string
): Promise<ResultadoMutacion<PasswordActualizada>> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  const resp = await callPhpApi<PasswordActualizada>(
    "/endpoint/web/cambiarPasswordWeb.php",
    {
      SessionToken: session.token,
      DeviceId: session.deviceId,
      PasswordActual: actual,
      PasswordNueva: nueva,
    }
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}

/* -------------------------------------------------------------------------- */
/* Correo (dos pasos)                                                         */
/* -------------------------------------------------------------------------- */

export type SolicitudEmail = {
  Token: string;
  EmailNuevo: string;
  ExpiraEnMinutos: number;
};

export async function solicitarCambioEmail(
  emailNuevo: string,
  password: string
): Promise<ResultadoMutacion<SolicitudEmail>> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  const resp = await callPhpApi<SolicitudEmail>(
    "/endpoint/web/emailCambioSolicitarWeb.php",
    {
      SessionToken: session.token,
      EmailNuevo: emailNuevo,
      PasswordActual: password,
    }
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}

export async function confirmarCambioEmail(
  tokenMovimiento: string,
  codigo: string
): Promise<ResultadoMutacion<{ Email: string; Usuario: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  const resp = await callPhpApi<{ Email: string; Usuario: string }>(
    "/endpoint/web/emailCambioConfirmarWeb.php",
    {
      SessionToken: session.token,
      Token: tokenMovimiento,
      Codigo: codigo,
    }
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}

/* -------------------------------------------------------------------------- */
/* Foto                                                                       */
/* -------------------------------------------------------------------------- */

export async function subirImagenPerfil(
  imagen: File
): Promise<ResultadoMutacion<{ ImagenUrl: string }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  // multipart tal cual: el endpoint lee $_FILES y reprocesa la imagen con GD.
  const form = new FormData();
  form.append("SessionToken", session.token);
  form.append("Accion", "SUBIR");
  form.append("Imagen", imagen, imagen.name);

  const resp = await callLegacyPhpApiFormData<{ ImagenUrl: string }>(
    "/endpoint/web/imagenPerfilWeb.php",
    form
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}

export async function eliminarImagenPerfil(): Promise<
  ResultadoMutacion<{ ImagenUrl: null }>
> {
  const session = await getSession();
  if (!session) return { ok: false, error: SIN_SESION };

  const resp = await callPhpApi<{ ImagenUrl: null }>(
    "/endpoint/web/imagenPerfilWeb.php",
    { SessionToken: session.token, Accion: "ELIMINAR" }
  );

  if (resp.Error !== "0") return fallo(resp);
  return { ok: true, data: resp };
}
