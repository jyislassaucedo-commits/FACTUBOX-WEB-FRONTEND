import { callLegacyPhpApi, type PhpResponse } from "./phpApi";
import { getSession } from "./session";
import { hexToArgbInt } from "./colorArgb";
import {
  CONFIG_PDF_DEFAULT,
  rawToForm,
  type ConfigPdfForm,
  type ConfigPdfRaw,
} from "./configPdfShared";

export type { ConfigPdfForm, ConfigPdfRaw };
export { CONFIG_PDF_DEFAULT };

export async function getConfigPdfs(rfcEmisor: string): Promise<ConfigPdfForm[]> {
  const session = await getSession();
  if (!session) return [];

  const resp = await callLegacyPhpApi<{ Configuraciones: ConfigPdfRaw[] }>(
    "/maa/mvc/Empresa/ConfigPDF/api/getConfigPdfsV2.php",
    { Token: session.token, RfcEmisor: rfcEmisor }
  );

  if (resp.Error !== "0") return [];
  return (resp.Configuraciones ?? []).map(rawToForm);
}

export async function saveConfigPdf(
  rfcEmisor: string,
  form: ConfigPdfForm
): Promise<PhpResponse<{ ConfigPdf: number }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  if (!form.nombre.trim()) {
    return { Error: "1", DescripError: "Falta el nombre de la configuración" };
  }

  const datosJSON: Record<string, unknown> = {
    Nombre: form.nombre.trim(),
    ColorFondo: hexToArgbInt(form.colorFondo),
    ColorFuente: hexToArgbInt(form.colorFuente),
    ColorContorno: hexToArgbInt(form.colorContorno),
    ColorSeparador: hexToArgbInt(form.colorSeparador),
    ColorTitulos: hexToArgbInt(form.colorTitulos),
    TipoImagen: "CUADRADO",
    GrosorSeparador: String(form.grosorSeparador),
    TamanoFuente: String(form.tamanoFuente),
    MostrarDecimales: form.mostrarDecimales ? "SI" : "NO",
    MostrarImpuestos: form.mostrarImpuestos ? "SI" : "NO",
    MostrarDescripSAT: form.mostrarDescripSat ? "SI" : "NO",
    MostrarImpLocales: form.mostrarImpLocales ? "SI" : "NO",
    MostrarDescuentos: form.mostrarDescuentos ? "SI" : "NO",
    MostrarMarcaAgua: form.mostrarMarcaAgua ? "SI" : "NO",
    TextoMarcaAgua: form.textoMarcaAgua,
    MostrarImportesCP: form.mostrarImportesCp ? "SI" : "NO",
  };

  if (form.imagenBase64 && form.imagenExtension) {
    datosJSON.Imagen = form.imagenBase64;
    datosJSON.ExtImagen = form.imagenExtension;
  }

  const datosJSON64 = Buffer.from(JSON.stringify(datosJSON)).toString("base64");

  return callLegacyPhpApi<{ ConfigPdf: number }>(
    "/maa/mvc/Empresa/ConfigPDF/api/setConfigPdfV2.php",
    { Token: session.token, DatosJSON: datosJSON64, RFCEmisor: rfcEmisor }
  );
}

export async function deleteConfigPdf(
  rfcEmisor: string,
  nombre: string
): Promise<PhpResponse<{ Descripcion: string }>> {
  const session = await getSession();
  if (!session) return { Error: "1", DescripError: "No autenticado" };

  return callLegacyPhpApi(
    "/maa/mvc/Empresa/ConfigPDF/api/deleteConfigPdfV2.php",
    { Token: session.token, RfcEmisor: rfcEmisor, Nombre: nombre }
  );
}
