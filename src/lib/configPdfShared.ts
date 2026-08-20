// Tipos y constantes seguros para importar desde componentes cliente - sin
// dependencias de servidor (session.ts / next/headers). configPdf.ts (que
// sí llama al backend) importa de aqui, no al reves.
import { argbIntToHex } from "./colorArgb";

export type ConfigPdfRaw = {
  Id: string;
  IdEmisor: string;
  Nombre: string;
  Imagen: string; // base64
  NombreImagen: string;
  ColorFondo: string;
  ColorFuente: string;
  ColorContorno: string;
  ColorSeparador: string;
  ColorTitulos: string;
  TipoImagen: string;
  GrosorSeparador: string;
  MostrarDecimales: string;
  MostrarImpuestos: string;
  MostrarDescripSAT: string;
  MostrarImpLocales: string;
  MostrarDescuentos: string;
  MostrarMarcaAgua: string;
  TextoMarcaAgua: string;
  TamanoFuente: string;
  MostrarImportesCP: string;
};

export type ConfigPdfForm = {
  nombre: string;
  colorFondo: string;
  colorFuente: string;
  colorContorno: string;
  colorSeparador: string;
  colorTitulos: string;
  grosorSeparador: number;
  tamanoFuente: number;
  mostrarDecimales: boolean;
  mostrarImpuestos: boolean;
  mostrarDescripSat: boolean;
  mostrarImpLocales: boolean;
  mostrarDescuentos: boolean;
  mostrarMarcaAgua: boolean;
  textoMarcaAgua: string;
  mostrarImportesCp: boolean;
  imagenBase64?: string;
  imagenExtension?: string;
};

export const CONFIG_PDF_DEFAULT: ConfigPdfForm = {
  nombre: "",
  colorFondo: "#e3e3e3",
  colorFuente: "#000000",
  colorContorno: "#e3e3e3",
  colorSeparador: "#e5c470",
  colorTitulos: "#000000",
  grosorSeparador: 0.6,
  tamanoFuente: 7.5,
  mostrarDecimales: true,
  mostrarImpuestos: true,
  mostrarDescripSat: true,
  mostrarImpLocales: true,
  mostrarDescuentos: true,
  mostrarMarcaAgua: false,
  textoMarcaAgua: "",
  mostrarImportesCp: true,
};

export function rawToForm(raw: ConfigPdfRaw): ConfigPdfForm {
  return {
    nombre: raw.Nombre,
    colorFondo: argbIntToHex(raw.ColorFondo, CONFIG_PDF_DEFAULT.colorFondo),
    colorFuente: argbIntToHex(raw.ColorFuente, CONFIG_PDF_DEFAULT.colorFuente),
    colorContorno: argbIntToHex(raw.ColorContorno, CONFIG_PDF_DEFAULT.colorContorno),
    colorSeparador: argbIntToHex(raw.ColorSeparador, CONFIG_PDF_DEFAULT.colorSeparador),
    colorTitulos: argbIntToHex(raw.ColorTitulos, CONFIG_PDF_DEFAULT.colorTitulos),
    grosorSeparador: parseFloat(raw.GrosorSeparador) || CONFIG_PDF_DEFAULT.grosorSeparador,
    tamanoFuente: parseFloat(raw.TamanoFuente) || CONFIG_PDF_DEFAULT.tamanoFuente,
    mostrarDecimales: raw.MostrarDecimales === "SI",
    mostrarImpuestos: raw.MostrarImpuestos === "SI",
    mostrarDescripSat: raw.MostrarDescripSAT === "SI",
    mostrarImpLocales: raw.MostrarImpLocales === "SI",
    mostrarDescuentos: raw.MostrarDescuentos === "SI",
    mostrarMarcaAgua: raw.MostrarMarcaAgua === "SI",
    textoMarcaAgua: raw.TextoMarcaAgua ?? "",
    mostrarImportesCp: raw.MostrarImportesCP === "SI",
    imagenBase64: raw.Imagen || undefined,
    imagenExtension: undefined,
  };
}
