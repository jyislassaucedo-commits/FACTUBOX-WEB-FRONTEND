import { callLegacyPhpApi } from "./phpApi";
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
