/* ---------------------------------------------------------------------------
   Los complementos con renglones repetibles: INE, Aerolíneas, Vales de
   despensa y Venta de vehículos.
   ---------------------------------------------------------------------------
   Se capturan con la lista resumida y su editor (opción C del mockup
   complementos-listas, aprobada el 2026-09-25). Los renglones viven en los
   datos del complemento como JSON (ver DefLista en complementos.ts).

   Campos y reglas: XSD del SAT de cada uno (maa/core/recursosSat/xsd) y los
   formularios de FACTUBOX-DESKTOP/Mvc/Complemento. El orden de los nodos hijos
   en aJson es el del XSD: JSON_CFDI40 respeta el orden de las llaves.
--------------------------------------------------------------------------- */

import type { DatosComplemento, DefComplemento, FilaComplemento, ProblemaComplemento } from "./complementos";
import { CURP, RFC, importe, sinVacios } from "./complementosUtil";

const t = (v: unknown) => (typeof v === "string" || typeof v === "number" ? String(v) : "").trim();
const T = (v: unknown) => t(v).toUpperCase();
const n = (v: unknown) => Number(t(v).replace(/,/g, "")) || 0;
const lista = (v: unknown): Record<string, unknown>[] =>
  (Array.isArray(v) ? v : v && typeof v === "object" ? [v] : []) as Record<string, unknown>[];
const obj = (v: unknown) => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function filas(d: DatosComplemento, id: string): FilaComplemento[] {
  try {
    const v = JSON.parse(d[id] || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function importeValido(f: FilaComplemento, campo: string, etiqueta: string): ProblemaComplemento[] {
  const v = t(f[campo]);
  return v && !(Number(v.replace(/,/g, "")) >= 0) ? [{ campo, mensaje: `${etiqueta} no es un importe válido` }] : [];
}

/* ---------------------------------------------------------------- INE -- */

const ENTIDADES_INE: Array<[string, string]> = [
  ["AGU", "Aguascalientes"], ["BCN", "Baja California"], ["BCS", "Baja California Sur"], ["CAM", "Campeche"],
  ["CHP", "Chiapas"], ["CHH", "Chihuahua"], ["COA", "Coahuila"], ["COL", "Colima"],
  ["CR1", "Circunscripción 1"], ["CR2", "Circunscripción 2"], ["CR3", "Circunscripción 3"],
  ["CR4", "Circunscripción 4"], ["CR5", "Circunscripción 5"], ["DIF", "Ciudad de México"],
  ["DUR", "Durango"], ["GUA", "Guanajuato"], ["GRO", "Guerrero"], ["HID", "Hidalgo"], ["JAL", "Jalisco"],
  ["MEX", "Estado de México"], ["MIC", "Michoacán"], ["MOR", "Morelos"], ["NAC", "Nacional"], ["NAY", "Nayarit"],
  ["NLE", "Nuevo León"], ["OAX", "Oaxaca"], ["PUE", "Puebla"], ["QUE", "Querétaro"], ["ROO", "Quintana Roo"],
  ["SLP", "San Luis Potosí"], ["SIN", "Sinaloa"], ["SON", "Sonora"], ["TAB", "Tabasco"], ["TAM", "Tamaulipas"],
  ["TLA", "Tlaxcala"], ["VER", "Veracruz"], ["YUC", "Yucatán"], ["ZAC", "Zacatecas"],
];
const nombreEntidad = (clave: string) => ENTIDADES_INE.find((e) => e[0] === clave)?.[1] ?? clave;

const esOrdinario = (d: DatosComplemento) => d.TipoProceso === "Ordinario";
/** Las reglas del Estándar INE 1.1, las mismas que aplica el escritorio. */
const llevaEntidades = (d: DatosComplemento) => !(esOrdinario(d) && d.TipoComite === "Ejecutivo Nacional");
const llevaIdRaiz = (d: DatosComplemento) =>
  esOrdinario(d) && (d.TipoComite === "Ejecutivo Nacional" || d.TipoComite === "Directivo Estatal");
const idsDe = (v: string | undefined) =>
  (v ?? "").split(",").map((x) => x.trim()).filter(Boolean);

const INE: DefComplemento = {
  id: "ine",
  nombre: "INE",
  descripcion: "Gastos de partidos políticos y campañas.",
  disponible: true,
  destino: "comprobante",
  nodo: "INE",
  campos: [
    {
      id: "TipoProceso",
      etiqueta: "Tipo de proceso",
      opciones: [
        { value: "Ordinario", label: "Ordinario" },
        { value: "Precampaña", label: "Precampaña" },
        { value: "Campaña", label: "Campaña" },
      ],
    },
    {
      id: "TipoComite",
      etiqueta: "Tipo de comité",
      obligatorio: true,
      visible: esOrdinario,
      opciones: [
        { value: "", label: "Elige…" },
        { value: "Ejecutivo Nacional", label: "Ejecutivo Nacional" },
        { value: "Ejecutivo Estatal", label: "Ejecutivo Estatal" },
        { value: "Directivo Estatal", label: "Directivo Estatal" },
      ],
    },
    {
      id: "IdContabilidad",
      etiqueta: "Id de contabilidad",
      numerico: true,
      visible: llevaIdRaiz,
      ayuda: "Hasta 6 dígitos, el que asigna el INE.",
    },
  ],
  porDefecto: { TipoProceso: "Campaña", TipoComite: "", IdContabilidad: "", entidades: "[]" },
  listas: [
    {
      id: "entidades",
      titulo: "Entidades",
      singular: "entidad",
      femenino: true,
      maximo: 76,
      visible: llevaEntidades,
      minimo: (d) => (llevaEntidades(d) ? 1 : 0),
      campos: [
        {
          id: "ClaveEntidad",
          etiqueta: "Entidad",
          obligatorio: true,
          opciones: [{ value: "", label: "Elige…" }, ...ENTIDADES_INE.map(([v, l]) => ({ value: v, label: `${v} - ${l}` }))],
        },
        {
          id: "Ambito",
          etiqueta: "Ámbito",
          obligatorio: true,
          // En Ordinario no va el ámbito; en Precampaña y Campaña es obligatorio.
          visible: (d) => !esOrdinario(d),
          opciones: [
            { value: "", label: "Elige…" },
            { value: "Local", label: "Local" },
            { value: "Federal", label: "Federal" },
          ],
        },
        {
          id: "Contabilidades",
          etiqueta: "Contabilidades",
          tipo: "ids",
          ayuda: "Los Id de contabilidad de esta entidad, de hasta 6 dígitos. Escribe uno y presiona Enter.",
        },
      ],
      porDefecto: { ClaveEntidad: "", Ambito: "", Contabilidades: "" },
      resumen: (f) => [
        f.ClaveEntidad ? `${f.ClaveEntidad} - ${nombreEntidad(f.ClaveEntidad)}` : "Sin entidad",
        [f.Ambito, `${idsDe(f.Contabilidades).length} contabilidad${idsDe(f.Contabilidades).length === 1 ? "" : "es"}`]
          .filter(Boolean)
          .join(" · "),
      ],
      revisarFila: (f) =>
        idsDe(f.Contabilidades).some((id) => !/^\d{1,6}$/.test(id))
          ? [{ campo: "Contabilidades", mensaje: "cada Id de contabilidad son hasta 6 dígitos" }]
          : [],
    },
  ],
  revisar: (d) => {
    const p: ProblemaComplemento[] = [];
    if (llevaIdRaiz(d) && t(d.IdContabilidad) && !/^\d{1,6}$/.test(t(d.IdContabilidad))) {
      p.push({ campo: "IdContabilidad", mensaje: "El Id de contabilidad son hasta 6 dígitos." });
    }
    const claves = filas(d, "entidades").map((f) => f.ClaveEntidad).filter(Boolean);
    if (llevaEntidades(d) && new Set(claves).size !== claves.length) {
      p.push({ campo: "entidades", mensaje: "Hay una entidad repetida: junta sus contabilidades en un solo renglón." });
    }
    return p;
  },
  aJson: (d) => ({
    Version: "1.1",
    TipoProceso: d.TipoProceso,
    ...sinVacios({
      TipoComite: esOrdinario(d) ? d.TipoComite : "",
      IdContabilidad: llevaIdRaiz(d) ? t(d.IdContabilidad) : "",
    }),
    ...(llevaEntidades(d)
      ? {
          Entidad: filas(d, "entidades").map((f) => ({
            ClaveEntidad: f.ClaveEntidad,
            ...(esOrdinario(d) ? {} : sinVacios({ Ambito: f.Ambito })),
            ...(idsDe(f.Contabilidades).length
              ? { Contabilidad: idsDe(f.Contabilidades).map((id) => ({ IdContabilidad: id })) }
              : {}),
          })),
        }
      : {}),
  }),
  desdeJson: (v) => ({
    TipoProceso: t(v.TipoProceso) || "Campaña",
    TipoComite: t(v.TipoComite),
    IdContabilidad: t(v.IdContabilidad),
    entidades: JSON.stringify(
      lista(v.Entidad).map((e) => ({
        ClaveEntidad: t(e.ClaveEntidad),
        Ambito: t(e.Ambito),
        Contabilidades: lista(e.Contabilidad).map((c) => t(c.IdContabilidad)).filter(Boolean).join(","),
      }))
    ),
  }),
};

/* --------------------------------------------------------- Aerolíneas -- */

const AEROLINEAS: DefComplemento = {
  id: "aerolineas",
  nombre: "Aerolíneas",
  descripcion: "TUA y otros cargos de boletos de avión.",
  disponible: true,
  destino: "comprobante",
  nodo: "Aerolineas",
  campos: [{ id: "TUA", etiqueta: "TUA (tarifa de uso de aeropuerto)", obligatorio: true, numerico: true }],
  porDefecto: { TUA: "", cargos: "[]" },
  listas: [
    {
      id: "cargos",
      titulo: "Otros cargos",
      singular: "cargo",
      ayuda: "Opcional. El total de otros cargos se calcula solo.",
      campos: [
        { id: "CodigoCargo", etiqueta: "Código del cargo", obligatorio: true, mayusculas: true, placeholder: "Ej. YQ" },
        { id: "Importe", etiqueta: "Importe", obligatorio: true, numerico: true },
      ],
      porDefecto: { CodigoCargo: "", Importe: "" },
      resumen: (f) => [f.CodigoCargo || "Sin código", "Cargo de la aerolínea"],
      monto: (f) => n(f.Importe),
      revisarFila: (f) => [
        ...(t(f.CodigoCargo).length > 8 ? [{ campo: "CodigoCargo", mensaje: "el código es de hasta 8 caracteres" }] : []),
        ...importeValido(f, "Importe", "el importe"),
      ],
    },
  ],
  revisar: (d) =>
    t(d.TUA) && !(n(d.TUA) >= 0) ? [{ campo: "TUA", mensaje: "La TUA no es un importe válido." }] : [],
  aJson: (d) => {
    const cargos = filas(d, "cargos");
    return {
      Version: "1.0",
      TUA: importe(d.TUA),
      ...(cargos.length
        ? {
            OtrosCargos: {
              TotalCargos: cargos.reduce((s, f) => s + n(f.Importe), 0).toFixed(2),
              Cargo: cargos.map((f) => ({ CodigoCargo: T(f.CodigoCargo), Importe: importe(f.Importe) })),
            },
          }
        : {}),
    };
  },
  desdeJson: (v) => ({
    TUA: t(v.TUA),
    cargos: JSON.stringify(
      lista(obj(v.OtrosCargos).Cargo).map((c) => ({ CodigoCargo: t(c.CodigoCargo), Importe: t(c.Importe) }))
    ),
  }),
};

/* --------------------------------------------------- Vales de despensa -- */

const VALES: DefComplemento = {
  id: "vales",
  nombre: "Vales de despensa",
  descripcion: "Monederos electrónicos: un renglón por empleado.",
  disponible: true,
  destino: "comprobante",
  nodo: "ValesDeDespensa",
  campos: [
    {
      id: "numeroDeCuenta",
      etiqueta: "Número de cuenta",
      obligatorio: true,
      ayuda: "La cuenta del monedero electrónico. El tipo de operación siempre es «monedero electrónico».",
    },
    { id: "registroPatronal", etiqueta: "Registro patronal", mayusculas: true },
  ],
  porDefecto: { numeroDeCuenta: "", registroPatronal: "", empleados: "[]" },
  listas: [
    {
      id: "empleados",
      titulo: "Empleados",
      singular: "empleado",
      minimo: 1,
      campos: [
        { id: "nombre", etiqueta: "Nombre", obligatorio: true },
        { id: "rfc", etiqueta: "RFC", obligatorio: true, mayusculas: true },
        { id: "curp", etiqueta: "CURP", obligatorio: true, mayusculas: true },
        { id: "numSeguridadSocial", etiqueta: "Número de seguridad social" },
        { id: "identificador", etiqueta: "Identificador del monedero", obligatorio: true },
        { id: "fecha", etiqueta: "Fecha", obligatorio: true, tipo: "fecha" },
        { id: "importe", etiqueta: "Importe", obligatorio: true, numerico: true },
      ],
      porDefecto: { nombre: "", rfc: "", curp: "", numSeguridadSocial: "", identificador: "", fecha: "", importe: "" },
      resumen: (f) => [f.nombre || "Sin nombre", [f.rfc, f.identificador].filter(Boolean).join(" · ") || "—"],
      monto: (f) => n(f.importe),
      revisarFila: (f) => [
        ...(t(f.rfc) && !RFC.test(T(f.rfc)) ? [{ campo: "rfc", mensaje: "el RFC no tiene el formato correcto" }] : []),
        ...(t(f.curp) && !CURP.test(T(f.curp)) ? [{ campo: "curp", mensaje: "la CURP no tiene el formato correcto" }] : []),
        ...(t(f.identificador).length > 20 ? [{ campo: "identificador", mensaje: "el identificador es de hasta 20 caracteres" }] : []),
        ...importeValido(f, "importe", "el importe"),
      ],
    },
  ],
  revisar: (d) =>
    t(d.numeroDeCuenta).length > 20 ? [{ campo: "numeroDeCuenta", mensaje: "El número de cuenta es de hasta 20 caracteres." }] : [],
  aJson: (d) => {
    const emp = filas(d, "empleados");
    return {
      version: "1.0",
      tipoOperacion: "monedero electrónico",
      ...sinVacios({ registroPatronal: T(d.registroPatronal) }),
      numeroDeCuenta: t(d.numeroDeCuenta),
      total: emp.reduce((s, f) => s + n(f.importe), 0).toFixed(2),
      Conceptos: {
        Concepto: emp.map((f) =>
          sinVacios({
            identificador: t(f.identificador),
            // xs:dateTime: el selector da solo la fecha.
            fecha: t(f.fecha).length === 10 ? `${t(f.fecha)}T00:00:00` : t(f.fecha),
            rfc: T(f.rfc),
            curp: T(f.curp),
            nombre: t(f.nombre),
            numSeguridadSocial: t(f.numSeguridadSocial),
            importe: importe(f.importe),
          })
        ),
      },
    };
  },
  desdeJson: (v) => ({
    numeroDeCuenta: t(v.numeroDeCuenta),
    registroPatronal: t(v.registroPatronal),
    empleados: JSON.stringify(
      lista(obj(v.Conceptos).Concepto).map((c) => ({
        nombre: t(c.nombre),
        rfc: t(c.rfc),
        curp: t(c.curp),
        numSeguridadSocial: t(c.numSeguridadSocial),
        identificador: t(c.identificador),
        fecha: t(c.fecha).slice(0, 10),
        importe: t(c.importe),
      }))
    ),
  }),
};

/* -------------------------------------------------- Venta de vehículos -- */

const VENTA_VEHICULOS: DefComplemento = {
  id: "ventavehiculos",
  nombre: "Venta de vehículos",
  descripcion: "Vehículos nuevos: clave vehicular, NIV y partes.",
  disponible: true,
  destino: "concepto",
  nodo: "VentaVehiculos",
  campos: [
    { id: "ClaveVehicular", etiqueta: "Clave vehicular", obligatorio: true, mayusculas: true },
    { id: "Niv", etiqueta: "NIV", obligatorio: true, mayusculas: true },
  ],
  porDefecto: { ClaveVehicular: "", Niv: "", pedimentos: "[]", partes: "[]" },
  listas: [
    {
      id: "pedimentos",
      titulo: "Pedimentos de importación",
      singular: "pedimento",
      ayuda: "Solo si el vehículo es importado. El SAT acepta pedimentos o partes, no los dos.",
      visible: (d) => filas(d, "partes").length === 0,
      campos: [
        { id: "numero", etiqueta: "Número de pedimento", obligatorio: true },
        { id: "fecha", etiqueta: "Fecha", obligatorio: true, tipo: "fecha" },
        { id: "aduana", etiqueta: "Aduana" },
      ],
      porDefecto: { numero: "", fecha: "", aduana: "" },
      resumen: (f) => [f.numero || "Sin número", [f.fecha, f.aduana].filter(Boolean).join(" · ") || "—"],
    },
    {
      id: "partes",
      titulo: "Partes y accesorios",
      singular: "parte",
      femenino: true,
      ayuda: "Opcional: lo que se vende junto con el vehículo. El SAT acepta partes o pedimentos, no los dos.",
      visible: (d) => filas(d, "pedimentos").length === 0,
      campos: [
        { id: "cantidad", etiqueta: "Cantidad", obligatorio: true, numerico: true },
        { id: "descripcion", etiqueta: "Descripción", obligatorio: true },
        { id: "unidad", etiqueta: "Unidad" },
        { id: "noIdentificacion", etiqueta: "Número de identificación", mayusculas: true },
        { id: "valorUnitario", etiqueta: "Valor unitario", numerico: true },
        { id: "importe", etiqueta: "Importe", numerico: true },
      ],
      porDefecto: { cantidad: "1", descripcion: "", unidad: "", noIdentificacion: "", valorUnitario: "", importe: "" },
      resumen: (f) => [`${f.cantidad || "?"} × ${f.descripcion || "Sin descripción"}`, f.noIdentificacion || "—"],
      monto: (f) => n(f.importe),
      revisarFila: (f) => [
        ...(t(f.cantidad) && !(n(f.cantidad) > 0) ? [{ campo: "cantidad", mensaje: "la cantidad debe ser mayor a cero" }] : []),
        ...importeValido(f, "valorUnitario", "el valor unitario"),
        ...importeValido(f, "importe", "el importe"),
      ],
    },
  ],
  // En el XSD, InformacionAduanera y Parte son un xs:choice: o los
  // pedimentos del vehículo, o sus partes. Cada lista se oculta cuando la otra
  // tiene renglones, y esto cubre lo que llegue de otro lado.
  revisar: (d) =>
    filas(d, "pedimentos").length > 0 && filas(d, "partes").length > 0
      ? [{ campo: "partes", mensaje: "Lleva pedimentos o partes, no los dos: el SAT solo acepta uno de los dos." }]
      : [],
  aJson: (d) => {
    const ped = filas(d, "pedimentos");
    const partes = filas(d, "partes");
    return {
      version: "1.1",
      ClaveVehicular: T(d.ClaveVehicular),
      Niv: T(d.Niv),
      ...(ped.length
        ? { InformacionAduanera: ped.map((f) => sinVacios({ numero: t(f.numero), fecha: t(f.fecha), aduana: t(f.aduana) })) }
        : {}),
      ...(partes.length
        ? {
            Parte: partes.map((f) =>
              sinVacios({
                cantidad: t(f.cantidad),
                unidad: t(f.unidad),
                noIdentificacion: T(f.noIdentificacion),
                descripcion: t(f.descripcion),
                valorUnitario: importe(f.valorUnitario),
                importe: importe(f.importe),
              })
            ),
          }
        : {}),
    };
  },
  desdeJson: (v) => ({
    ClaveVehicular: t(v.ClaveVehicular),
    Niv: t(v.Niv),
    pedimentos: JSON.stringify(
      lista(v.InformacionAduanera).map((a) => ({ numero: t(a.numero), fecha: t(a.fecha), aduana: t(a.aduana) }))
    ),
    partes: JSON.stringify(
      lista(v.Parte).map((p) => ({
        cantidad: t(p.cantidad),
        descripcion: t(p.descripcion),
        unidad: t(p.unidad),
        noIdentificacion: t(p.noIdentificacion),
        valorUnitario: t(p.valorUnitario),
        importe: t(p.importe),
      }))
    ),
  }),
};

export const COMPLEMENTOS_LISTAS: DefComplemento[] = [INE, AEROLINEAS, VALES, VENTA_VEHICULOS];
