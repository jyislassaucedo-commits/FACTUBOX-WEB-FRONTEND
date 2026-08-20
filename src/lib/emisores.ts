import {
  callLegacyPhpApi,
  callLegacyPhpApiFormData,
  callPhpApi,
  type PhpResponse,
} from "./phpApi";
import { getSession } from "./session";
import type { EstatusEmisor } from "./emisoresShared";

export type Emisor = {
  Rfc: string;
  Nombre: string;
  Regimen: string;
  LugarExp: string;
  Estatus: string;
  Cert: string;
  Key: string;
  VigenciaCert: string;
  Token: string;
};

export type EmisorDetalle = {
  Token: string;
  Rfc: string;
  Nombre: string;
  Regimen: string;
  LugarExp: string;
  Estatus: string;
  VigenciaCert: string;
  InicioCert: string;
  Logo: string; // base64
  NombreLogo: string;
};

export type EmisorInput = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  logoBase64?: string; // sin el prefijo data:...;base64,
  logoExtension?: string; // ej. ".png"
  /**
   * Estatus actual del emisor, para CONSERVARLO al editar.
   *
   * No es un campo que el formulario ofrezca: setEmpresaV2.php hace
   * setStatus("ACTIVADO") por defecto y solo lo respeta si el JSON trae
   * "Estatus". Sin esto, guardar el nombre de un emisor desactivado lo
   * reactivaba en silencio. En alta se omite y el default es el correcto.
   */
  estatus?: string;
};

export async function getEmisores(): Promise<Emisor[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Usuario: number; Empresas: Emisor[] }>(
    "/maa/mvc/Empresa/api/getListEmpresasV2.php",
    { Token: session.token }
  );

  if (resp.Error !== "0") return [];
  return resp.Empresas ?? [];
}

export async function getEmisor(rfc: string): Promise<EmisorDetalle | null> {
  const session = await getSession();
  if (!session) return null;

  const resp = await callLegacyPhpApi<EmisorDetalle>(
    "/maa/mvc/Empresa/api/getEmpresaV2.php",
    { Token: session.token, RfcEmisor: rfc }
  );

  if (resp.Error !== "0") return null;
  return resp;
}

export async function saveEmisor(
  input: EmisorInput
): Promise<PhpResponse<{ Usuario: number; Token: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON: Record<string, string> = {
    Rfc: input.rfc,
    Nombre: input.nombre,
    RegimenFiscal: input.regimenFiscal,
    DomicilioFiscal: input.domicilioFiscal,
    Logo: input.logoBase64 ?? "",
    ExtensionLogo: input.logoExtension ?? "",
  };

  // Solo se manda si viene: en alta no hay estatus previo que conservar y el
  // default "ACTIVADO" del PHP es justo lo que se quiere.
  if (input.estatus) {
    datosJSON.Estatus = input.estatus;
  }

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<{ Usuario: number; Token: string }>(
    "/maa/mvc/Empresa/api/setEmpresaV2.php",
    { Token: session.token, DatosJSON: datosJSON64 }
  );
}

/**
 * Activa o desactiva un emisor.
 *
 * Va contra el endpoint web nuevo y no contra setEmpresaV2.php: ese exige el
 * JSON completo del emisor y escribe con DAO_EMPRESA::edit(), que reescribe la
 * fila entera incluyendo el CSD. Aqui solo se mueve una columna.
 */
export async function cambiarEstatusEmisor(
  rfc: string,
  estatus: EstatusEmisor
): Promise<PhpResponse<{ Rfc: string; Estatus: string; Cambio: "SI" | "NO" }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callPhpApi<{ Rfc: string; Estatus: string; Cambio: "SI" | "NO" }>(
    "/endpoint/web/estatusEmisorWeb.php",
    { SessionToken: session.token, Rfc: rfc, Estatus: estatus }
  );
}

export type ValidarCsdResult = {
  VigenciaCertificados: string;
  Rfc: string;
  Existente: "SI" | "NO";
  RazonSocial: string;
};

// Valida estructura/password del CSD SIN persistirlo (dry-run) - usado
// antes de subirlo, para mostrar el RFC/razon social encontrados y detectar
// si no corresponde a este emisor.
export async function validarCsd(
  csd: File,
  key: File,
  pass: string
): Promise<PhpResponse<ValidarCsdResult>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const formData = new FormData();
  formData.append("Token", session.token);
  // validarCSDV2.php exige EmpresaToken pero no lo usa para nada en el
  // cuerpo del endpoint (es una validacion generica, no ligada a un
  // emisor en particular) - se manda un valor fijo solo para cumplir el
  // contrato de "atributo declarado".
  formData.append("EmpresaToken", "validacion");
  formData.append("Pass", pass);
  formData.append("Csd", csd, csd.name);
  formData.append("Key", key, key.name);

  return callLegacyPhpApiFormData<ValidarCsdResult>(
    "/maa/mvc/Empresa/api/validarCSDV2.php",
    formData
  );
}

export async function existeCsd(empresaToken: string): Promise<boolean> {
  const session = await getSession();
  if (!session) return false;

  const resp = await callLegacyPhpApi<{ Result: string }>(
    "/maa/mvc/Empresa/api/existeCSDV2.php",
    { Token: session.token, EmpresaToken: empresaToken }
  );

  return resp.Error === "0" && resp.Result === "True";
}

export async function uploadCsd(
  empresaToken: string,
  csd: File,
  key: File,
  pass: string
): Promise<
  PhpResponse<{ VigenciaCertificados: string; Rfc: string; RazonSocial: string }>
> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const formData = new FormData();
  formData.append("Token", session.token);
  formData.append("EmpresaToken", empresaToken);
  formData.append("KeyNombre", key.name);
  formData.append("CsdNombre", csd.name);
  formData.append("Pass", pass);
  formData.append("Csd", csd, csd.name);
  formData.append("Key", key, key.name);

  return callLegacyPhpApiFormData(
    "/maa/mvc/Empresa/api/uploadCertificadoEmpresaV2.php",
    formData
  );
}
