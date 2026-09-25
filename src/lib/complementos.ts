/* ---------------------------------------------------------------------------
   Complementos "chicos" de la factura.
   ---------------------------------------------------------------------------
   SIN "use client" y sin dependencias de servidor: lo usa el paso de
   Complementos del asistente (qué pedir y qué falta) y buildDatosJSON en el
   servidor (cómo va en el JSON que arma el XML). Tener las dos cosas en la
   misma entrada es lo que evita que la pantalla pida un campo que el JSON no
   manda, o al revés.

   Agregar un complemento es agregar una entrada a COMPLEMENTOS. Los que están
   en `disponible: false` se ven en la pantalla como "Próximamente": se van
   activando de uno en uno conforme se prueban contra el PAC.

   Las formas del JSON son las que acepta endpoint/lib/JSON_CFDI40.php:
   `Complemento.<Nodo>` para los del comprobante e
   `Concepto.ComplementoConcepto.<Nodo>` para los de concepto (iedu).
--------------------------------------------------------------------------- */

import { COMPLEMENTOS_EXTRA, COMPLEMENTOS_PROXIMAMENTE } from "./complementosExtra";
import { CURP, round2, sinVacios } from "./complementosUtil";

export type CampoComplemento = {
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  opciones?: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  ayuda?: string;
  numerico?: boolean;
  /** Fecha (AAAA-MM-DD) o fecha y hora: se captura con el selector del navegador. */
  tipo?: "fecha" | "fechaHora";
  /** Se guarda en mayúsculas (RFC, placas, claves). */
  mayusculas?: boolean;
};

/** Datos capturados de un complemento: campo → valor. */
export type DatosComplemento = Record<string, string>;

/** Complementos activos en el borrador: id → sus datos. Si el id no está, no va. */
export type ComplementosBorrador = Record<string, DatosComplemento>;

export type ProblemaComplemento = { campo: string; mensaje: string };

type Contexto = {
  /** SubTotal del comprobante: base de los impuestos locales. */
  subtotal: number;
};

export type DefComplemento = {
  id: string;
  nombre: string;
  descripcion: string;
  disponible: boolean;
  campos: CampoComplemento[];
  porDefecto: DatosComplemento;
  /** Dónde va en el JSON. */
  destino: "comprobante" | "concepto";
  /** Nombre del nodo raíz, con las mayúsculas exactas del SAT. */
  nodo: string;
  aJson: (datos: DatosComplemento, ctx: Contexto) => Record<string, unknown>;
  /** Revisiones propias además de los campos obligatorios. */
  revisar?: (datos: DatosComplemento) => ProblemaComplemento[];
};

/** Importe del impuesto local: tasa en porcentaje sobre el SubTotal. */
export function importeLocal(datos: DatosComplemento, subtotal: number) {
  const tasa = parseFloat(datos.tasa);
  return tasa > 0 ? round2((subtotal * tasa) / 100) : 0;
}

export const COMPLEMENTOS: DefComplemento[] = [
  {
    id: "implocal",
    nombre: "Impuestos locales",
    descripcion: "Impuestos estatales, como el de hospedaje (ISH) o los cedulares.",
    disponible: true,
    destino: "comprobante",
    nodo: "ImpuestosLocales",
    campos: [
      { id: "impuesto", etiqueta: "Nombre del impuesto", obligatorio: true, placeholder: "Ej. ISH" },
      {
        id: "tipo",
        etiqueta: "Tipo",
        opciones: [
          { value: "traslado", label: "Trasladado (se suma al total)" },
          { value: "retencion", label: "Retenido (se resta del total)" },
        ],
      },
      {
        id: "tasa",
        etiqueta: "Tasa (%)",
        obligatorio: true,
        numerico: true,
        placeholder: "Ej. 3",
        ayuda: "Se aplica sobre el subtotal de la factura.",
      },
    ],
    porDefecto: { impuesto: "", tipo: "traslado", tasa: "" },
    revisar: (d) => {
      const t = parseFloat(d.tasa);
      return d.tasa.trim() && !(t > 0 && t < 100)
        ? [{ campo: "tasa", mensaje: "La tasa debe ser un porcentaje mayor a 0 y menor a 100." }]
        : [];
    },
    // Retenciones antes que traslados: es el orden del esquema implocal, y
    // JSON_CFDI40 respeta el orden de las llaves.
    aJson: (d, ctx) => {
      const importe = importeLocal(d, ctx.subtotal).toFixed(2);
      const tasa = (parseFloat(d.tasa) || 0).toFixed(2);
      const esRetencion = d.tipo === "retencion";
      return {
        version: "1.0",
        TotaldeRetenciones: esRetencion ? importe : "0.00",
        TotaldeTraslados: esRetencion ? "0.00" : importe,
        ...(esRetencion
          ? { RetencionesLocales: [{ ImpLocRetenido: d.impuesto.trim(), TasadeRetencion: tasa, Importe: importe }] }
          : { TrasladosLocales: [{ ImpLocTrasladado: d.impuesto.trim(), TasadeTraslado: tasa, Importe: importe }] }),
      };
    },
  },
  {
    id: "iedu",
    nombre: "Instituciones educativas",
    descripcion: "Colegiaturas de escuelas particulares: los datos del alumno.",
    disponible: true,
    destino: "concepto",
    nodo: "instEducativas",
    campos: [
      { id: "nombreAlumno", etiqueta: "Nombre del alumno", obligatorio: true },
      { id: "CURP", etiqueta: "CURP del alumno", obligatorio: true, placeholder: "18 caracteres" },
      {
        id: "nivelEducativo",
        etiqueta: "Nivel educativo",
        opciones: [
          { value: "Preescolar", label: "Preescolar" },
          { value: "Primaria", label: "Primaria" },
          { value: "Secundaria", label: "Secundaria" },
          { value: "Profesional técnico", label: "Profesional técnico" },
          { value: "Bachillerato o su equivalente", label: "Bachillerato o su equivalente" },
        ],
      },
      { id: "autRVOE", etiqueta: "Clave del centro de trabajo o RVOE", obligatorio: true },
      {
        id: "rfcPago",
        etiqueta: "RFC de quien paga",
        placeholder: "Solo si no es el receptor",
      },
    ],
    porDefecto: { nombreAlumno: "", CURP: "", nivelEducativo: "Primaria", autRVOE: "", rfcPago: "" },
    revisar: (d) =>
      d.CURP.trim() && !CURP.test(d.CURP.trim().toUpperCase())
        ? [{ campo: "CURP", mensaje: "La CURP no tiene el formato correcto (18 caracteres)." }]
        : [],
    aJson: (d) => ({
      version: "1.0",
      ...sinVacios({
        nombreAlumno: d.nombreAlumno.trim(),
        CURP: d.CURP.trim().toUpperCase(),
        nivelEducativo: d.nivelEducativo,
        autRVOE: d.autRVOE.trim(),
        rfcPago: d.rfcPago?.trim().toUpperCase(),
      }),
    }),
  },
  {
    id: "leyendas",
    nombre: "Leyendas fiscales",
    descripcion: "Textos que exige alguna disposición fiscal.",
    disponible: true,
    destino: "comprobante",
    nodo: "LeyendasFiscales",
    campos: [
      { id: "disposicionFiscal", etiqueta: "Disposición fiscal", placeholder: "Ej. LISR" },
      { id: "norma", etiqueta: "Norma", placeholder: "Ej. Art. 151" },
      { id: "textoLeyenda", etiqueta: "Texto de la leyenda", obligatorio: true },
    ],
    porDefecto: { disposicionFiscal: "", norma: "", textoLeyenda: "" },
    aJson: (d) => ({
      version: "1.0",
      Leyenda: [
        sinVacios({
          disposicionFiscal: d.disposicionFiscal,
          norma: d.norma,
          textoLeyenda: d.textoLeyenda,
        }),
      ],
    }),
  },
  ...COMPLEMENTOS_EXTRA,
  ...COMPLEMENTOS_PROXIMAMENTE,
];

export function complementoDe(id: string) {
  return COMPLEMENTOS.find((c) => c.id === id);
}

/** Los complementos activos que de verdad existen y están disponibles. */
export function activos(complementos: ComplementosBorrador | undefined) {
  return COMPLEMENTOS.filter((c) => c.disponible && complementos && c.id in complementos);
}

/** Lo que falta en cada complemento activo, con el campo prefijado por su id. */
export function problemasDeComplementos(complementos: ComplementosBorrador | undefined) {
  const problemas: ProblemaComplemento[] = [];
  for (const def of activos(complementos)) {
    const datos = complementos![def.id];
    for (const campo of def.campos) {
      if (campo.obligatorio && !(datos[campo.id] ?? "").trim()) {
        problemas.push({
          campo: `complemento.${def.id}.${campo.id}`,
          mensaje: `${def.nombre}: falta ${campo.etiqueta.toLowerCase()}.`,
        });
      }
    }
    for (const p of def.revisar?.(datos) ?? []) {
      problemas.push({ campo: `complemento.${def.id}.${p.campo}`, mensaje: `${def.nombre}: ${p.mensaje}` });
    }
  }
  return problemas;
}

/** Suma de impuestos locales: lo que se agrega y lo que se resta al Total. */
export function totalesLocales(complementos: ComplementosBorrador | undefined, subtotal: number) {
  let traslados = 0;
  let retenciones = 0;
  const implocal = activos(complementos).find((c) => c.id === "implocal");
  if (implocal) {
    const datos = complementos!.implocal;
    const importe = importeLocal(datos, subtotal);
    if (datos.tipo === "retencion") retenciones += importe;
    else traslados += importe;
  }
  return { traslados, retenciones };
}
