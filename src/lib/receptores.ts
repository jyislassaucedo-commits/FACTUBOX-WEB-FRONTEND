import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";

export type Receptor = {
  Rfc: string;
  Nombre: string;
  RegimenFiscal: string;
  DomicilioFiscal: string;
  UsoCfdi: string;
  Moneda?: string;
  ResidenciaFiscal?: string;
  ClaveIdentFiscal?: string;
  NombreContacto?: string;
  CorreoElectronico?: string;
  CorreoElectronico2?: string;
  Curp?: string;
};

export type ReceptorInput = {
  rfc: string;
  nombre: string;
  regimenFiscal: string;
  domicilioFiscal: string;
  usoCfdi: string;
  correoElectronico?: string;
};

// XAXX010101000 (Publico en General) y XEXX010101000 (Extranjero) se
// gestionan aparte via RECEPTOR_GENERICO - no son receptores reales que el
// usuario deba ver/editar en este CRUD.
const RFC_GENERICOS = new Set(["XAXX010101000", "XEXX010101000"]);

export async function getReceptores(rfcEmisor: string): Promise<Receptor[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Receptores: Receptor[] }>(
    "/maa/mvc/Receptor/api/getReceptoresV2.php",
    { Token: session.token, RfcEmisor: rfcEmisor }
  );

  if (resp.Error !== "0") return [];
  return (resp.Receptores ?? []).filter((r) => !RFC_GENERICOS.has(r.Rfc));
}

export async function saveReceptor(
  rfcEmisor: string,
  input: ReceptorInput
): Promise<PhpResponse<{ RFCReceptor: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  const datosJSON = {
    Rfc: input.rfc,
    Nombre: input.nombre,
    RegimenFiscal: input.regimenFiscal,
    DomicilioFiscal: input.domicilioFiscal,
    UsoCfdi: input.usoCfdi,
    // Varias columnas de RECEPTOR son NOT NULL en la BD (moneda,
    // residenciafiscal, claveidentfiscal, nombrecontacto, correoelectronico,
    // curp, correoelectronico2), pero setReceptorV2.php solo las setea si
    // vienen en el JSON (isset) - si se omiten, el INSERT truena con
    // "Column 'x' cannot be null". Se manda "" para las que no aplican.
    Moneda: "MXN",
    ResidenciaFiscal: "",
    ClaveIdentFiscal: "",
    NombreContacto: "",
    CorreoElectronico: input.correoElectronico ?? "",
    Curp: "",
    CorreoElectronico2: "",
  };
  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<{ RFCReceptor: string }>(
    "/maa/mvc/Receptor/api/setReceptorV2.php",
    { Token: session.token, RFCEmisor: rfcEmisor, DatosJSON: datosJSON64 }
  );
}

export async function deleteReceptor(
  rfcEmisor: string,
  rfcReceptor: string
): Promise<PhpResponse<{ Descripcion: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi("/maa/mvc/Receptor/api/deleteReceptorV2.php", {
    Token: session.token,
    RfcEmisor: rfcEmisor,
    RfcReceptor: rfcReceptor,
  });
}
