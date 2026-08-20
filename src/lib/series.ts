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

// Ultimo folio USADO (0 si nunca se ha facturado con esta serie) - el
// siguiente folio a usar es este valor + 1, o el "Inicio" de la serie si
// nunca se ha usado.
export async function getUltimoFolio(rfc: string, serie: string): Promise<number> {
  const session = await getSession();
  if (!session) return 0;

  const resp = await callLegacyPhpApi<{ Folio: string }>(
    "/maa/mvc/Factura/api/getLastFolioV2.php",
    { Token: session.token, Serie: serie, Emisor: rfc }
  );

  if (resp.Error !== "0") return 0;
  return parseInt(resp.Folio, 10) || 0;
}

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
