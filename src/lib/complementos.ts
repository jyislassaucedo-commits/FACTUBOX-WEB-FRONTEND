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

import { COMPLEMENTOS_EXTRA } from "./complementosExtra";
import { COMPLEMENTOS_LISTAS } from "./complementosListas";
import { CURP, round2, sinVacios } from "./complementosUtil";

export type CampoComplemento = {
  id: string;
  etiqueta: string;
  obligatorio?: boolean;
  opciones?: ReadonlyArray<{ value: string; label: string }>;
  placeholder?: string;
  ayuda?: string;
  numerico?: boolean;
  /**
   * fecha / fechaHora: el selector del navegador. ids: una lista corta de
   * claves numéricas (las contabilidades del INE), guardada separada por comas.
   */
  tipo?: "fecha" | "fechaHora" | "ids";
  /** Se guarda en mayúsculas (RFC, placas, claves). */
  mayusculas?: boolean;
  /** Solo se pide (y solo se revisa) cuando esto da true. */
  visible?: (datos: DatosComplemento) => boolean;
};

/** Un renglón de una lista repetible: campo → valor. */
export type FilaComplemento = Record<string, string>;

/**
 * Una lista repetible dentro de un complemento (las entidades del INE, los
 * cargos de aerolínea, los empleados de los vales). Se captura con la lista
 * resumida y su editor (opción C del mockup complementos-listas, aprobada el
 * 2026-09-25), igual que "Agregar pago".
 *
 * Sus renglones viven en los datos del complemento, bajo `id`, como JSON:
 * así los datos siguen siendo texto plano en el borrador, en la prefactura de
 * la nube y en el cuerpo que llega al servidor.
 */
export type DefLista = {
  id: string;
  titulo: string;
  /** "entidad", "cargo", "empleado": para "Agregar entidad", "Entidad 2". */
  singular: string;
  /** Para decir "una entidad" y no "un entidad". */
  femenino?: boolean;
  campos: CampoComplemento[];
  porDefecto: FilaComplemento;
  /** Lo que se ve de cada renglón en la lista: título y detalle. */
  resumen: (fila: FilaComplemento, datos: DatosComplemento) => [string, string];
  /** Si los renglones suman un importe, cuánto aporta cada uno. */
  monto?: (fila: FilaComplemento) => number;
  /** Mínimo de renglones: fijo o según la cabecera. */
  minimo?: number | ((datos: DatosComplemento) => number);
  maximo?: number;
  /** Si se pide la lista, según la cabecera (INE: Ejecutivo Nacional no lleva entidades). */
  visible?: (datos: DatosComplemento) => boolean;
  revisarFila?: (fila: FilaComplemento, datos: DatosComplemento) => ProblemaComplemento[];
  ayuda?: string;
};

/** Los renglones de una lista, leídos de los datos del complemento. */
export function filasDe(datos: DatosComplemento | undefined, idLista: string): FilaComplemento[] {
  try {
    const v = JSON.parse(datos?.[idLista] || "[]");
    return Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : [];
  } catch {
    return [];
  }
}

/** Los datos del complemento con otros renglones en una lista. */
export function conFilas(datos: DatosComplemento, idLista: string, filas: FilaComplemento[]): DatosComplemento {
  return { ...datos, [idLista]: JSON.stringify(filas) };
}

export function campoVisible(campo: CampoComplemento, datos: DatosComplemento) {
  return campo.visible ? campo.visible(datos) : true;
}

/** Lo que le falta a un renglón: obligatorios vacíos y sus revisiones propias. */
export function problemasDeFila(lista: DefLista, fila: FilaComplemento, datos: DatosComplemento): ProblemaComplemento[] {
  const p: ProblemaComplemento[] = [];
  for (const c of lista.campos) {
    if (c.obligatorio && campoVisible(c, datos) && !(fila[c.id] ?? "").trim()) {
      p.push({ campo: c.id, mensaje: `falta ${c.etiqueta.toLowerCase()}` });
    }
  }
  return [...p, ...(lista.revisarFila?.(fila, datos) ?? [])];
}

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
  /** Listas repetibles del complemento, en el orden en que se muestran. */
  listas?: DefLista[];
  /**
   * El camino de vuelta: de su nodo en el JSON del CFDI a los datos del
   * asistente. Con él una prefactura guardada se vuelve a abrir con el
   * complemento; sin él se avisa que la web no lo edita.
   */
  desdeJson?: (nodo: Record<string, unknown>) => DatosComplemento;
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
  ...COMPLEMENTOS_LISTAS,
  ...COMPLEMENTOS_EXTRA,
];

/**
 * De su nodo en el JSON del CFDI a los datos del asistente, para reabrir una
 * prefactura. Si el complemento no trae su propio desdeJson, se toman los
 * atributos del nodo y de sus hijos (el primero de cada lista) cuyos nombres
 * coinciden con los campos: sirve para los que no renombran nada.
 */
export function datosDesdeJson(def: DefComplemento, nodo: Record<string, unknown>): DatosComplemento {
  if (def.desdeJson) return def.desdeJson(nodo);
  const planos: Record<string, string> = {};
  const recorrer = (v: unknown) => {
    const o = Array.isArray(v) ? v[0] : v;
    if (!o || typeof o !== "object") return;
    for (const [k, x] of Object.entries(o as Record<string, unknown>)) {
      if (typeof x === "string" || typeof x === "number") planos[k] ??= String(x);
      else recorrer(x);
    }
  };
  recorrer(nodo);
  return Object.fromEntries(Object.keys(def.porDefecto).map((k) => [k, planos[k] ?? def.porDefecto[k]]));
}

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
      if (campo.obligatorio && campoVisible(campo, datos) && !(datos[campo.id] ?? "").trim()) {
        problemas.push({
          campo: `complemento.${def.id}.${campo.id}`,
          mensaje: `${def.nombre}: falta ${campo.etiqueta.toLowerCase()}.`,
        });
      }
    }
    for (const p of def.revisar?.(datos) ?? []) {
      problemas.push({ campo: `complemento.${def.id}.${p.campo}`, mensaje: `${def.nombre}: ${p.mensaje}` });
    }
    for (const lista of def.listas ?? []) {
      if (lista.visible && !lista.visible(datos)) continue;
      const filas = filasDe(datos, lista.id);
      const minimo = typeof lista.minimo === "function" ? lista.minimo(datos) : (lista.minimo ?? 0);
      if (filas.length < minimo) {
        problemas.push({
          campo: `complemento.${def.id}.${lista.id}`,
          mensaje: `${def.nombre}: agrega al menos ${minimo === 1 ? `${lista.femenino ? "una" : "un"} ${lista.singular}` : `${minimo} renglones`}.`,
        });
      }
      if (lista.maximo && filas.length > lista.maximo) {
        problemas.push({
          campo: `complemento.${def.id}.${lista.id}`,
          mensaje: `${def.nombre}: son como máximo ${lista.maximo} renglones.`,
        });
      }
      filas.forEach((fila, i) => {
        for (const p of problemasDeFila(lista, fila, datos)) {
          problemas.push({
            campo: `complemento.${def.id}.${lista.id}.${i}.${p.campo}`,
            mensaje: `${def.nombre}, ${lista.singular} ${i + 1}: ${p.mensaje}.`,
          });
        }
      });
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
