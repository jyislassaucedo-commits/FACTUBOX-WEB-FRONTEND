import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getEmisor } from "./emisores";
import { getSession } from "./session";
import type { EstadoAutofactura } from "./autofacturaShared";

// El lado del emisor (con sesión) de la autofactura por QR: ver y administrar
// las ventas que sus integradores dejaron pendientes de que el cliente
// facture. Habla con apiAutofacturaV2.php, el mismo endpoint que usan los
// integradores, con el token de sesión del usuario y el token del emisor.
// La parte pública (lo que ve el comprador) está en autofactura.ts.

/** Un renglón de Tarea=LISTAR / ESTATUS. */
export type AutofacturaEmisor = {
  Codigo: string;
  Estado: EstadoAutofactura;
  Referencia: string;
  Total: string;
  Moneda: string;
  Expira: string;
  UUID: string;
  FechaTimbrado: string;
  EmailReceptor: string;
  CorreoEnviado: "SI" | "NO";
  CorreoError: string;
  Intentos: number;
  UltimoError: string;
  FechaReg: string;
  Url: string;
  UrlQR: string;
};

async function llamar<T>(rfcEmisor: string, tarea: string, extra: Record<string, string> = {}): Promise<PhpResponse<T>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const emisor = await getEmisor(rfcEmisor);
  if (!emisor) return { Error: "1", DescripError: "El emisor no existe o no te pertenece" };

  return callLegacyPhpApi<T>("/endpoint/apiAutofacturaV2.php", {
    SessionToken: session.token,
    Token: emisor.Token,
    Tarea: tarea,
    ...extra,
  });
}

export async function getAutofacturas(rfcEmisor: string): Promise<AutofacturaEmisor[]> {
  const resp = await llamar<{ Autofacturas: AutofacturaEmisor[] }>(rfcEmisor, "LISTAR", { Limite: "500" });
  if (resp.Error !== "0") return [];
  return resp.Autofacturas ?? [];
}

export async function cancelarAutofactura(rfcEmisor: string, codigo: string) {
  return llamar<{ Estado: EstadoAutofactura }>(rfcEmisor, "CANCELAR", { Codigo: codigo });
}

export async function reenviarCorreoAutofactura(rfcEmisor: string, codigo: string, email?: string) {
  return llamar<{ CorreoEnviado: "SI" | "NO"; CorreoError: string }>(rfcEmisor, "REENVIAR_CORREO", {
    Codigo: codigo,
    ...(email ? { EmailReceptor: email } : {}),
  });
}
