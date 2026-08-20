import {
  callLegacyPhpApi,
  callLegacyPhpApiFormData,
  type PhpResponse,
} from "./phpApi";
import { getSession } from "./session";

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

  const datosJSON = {
    Rfc: input.rfc,
    Nombre: input.nombre,
    RegimenFiscal: input.regimenFiscal,
    DomicilioFiscal: input.domicilioFiscal,
    Logo: input.logoBase64 ?? "",
    ExtensionLogo: input.logoExtension ?? "",
  };
  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<{ Usuario: number; Token: string }>(
    "/maa/mvc/Empresa/api/setEmpresaV2.php",
    { Token: session.token, DatosJSON: datosJSON64 }
  );
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
