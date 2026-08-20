import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";

export type Serie = {
  Nombre: string;
  Tipo: string;
  Inicio: string;
};

export type SerieInput = {
  nombre: string;
  tipo: string;
  inicio: string;
};

export async function getSeries(rfc: string): Promise<Serie[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Series: Serie[] }>(
    "/maa/mvc/Serie/api/getListSeriesV2.php",
    { Token: session.token, RFC: rfc }
  );

  if (resp.Error !== "0") return [];
  return resp.Series ?? [];
}

export async function newSerie(
  rfc: string,
  input: SerieInput
): Promise<PhpResponse<{ Descripcion: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON64 = Buffer.from(
    JSON.stringify({ Tipo: input.tipo, Inicio: input.inicio, Nombre: input.nombre })
  ).toString("base64");

  return callLegacyPhpApi("/maa/mvc/Serie/api/newSerieV2.php", {
    Token: session.token,
    RFC: rfc,
    DatosJSON: datosJSON64,
  });
}

export async function editSerie(
  rfc: string,
  input: SerieInput,
  anterior: { nombre: string; tipo: string }
): Promise<PhpResponse<{ Descripcion: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON64 = Buffer.from(
    JSON.stringify({
      Tipo: input.tipo,
      Inicio: input.inicio,
      Nombre: input.nombre,
      TipoAnterior: anterior.tipo,
      NombreAnterior: anterior.nombre,
    })
  ).toString("base64");

  return callLegacyPhpApi("/maa/mvc/Serie/api/editSerieV2.php", {
    Token: session.token,
    RFC: rfc,
    DatosJSON: datosJSON64,
  });
}

export async function deleteSerie(
  rfc: string,
  nombre: string,
  tipo: string
): Promise<PhpResponse<{ Descripcion: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON64 = Buffer.from(JSON.stringify({ Tipo: tipo, Nombre: nombre })).toString(
    "base64"
  );

  return callLegacyPhpApi("/maa/mvc/Serie/api/deleteSerieV2.php", {
    Token: session.token,
    RFC: rfc,
    DatosJSON: datosJSON64,
  });
}
