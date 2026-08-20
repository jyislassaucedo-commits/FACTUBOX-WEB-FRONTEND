/* ---------------------------------------------------------------------------
   Agregaciones del tablero de inicio.
   ---------------------------------------------------------------------------
   Funciones puras sobre los datos que ya trajo el servidor. Sin "use client" y
   sin dependencias de servidor: las usan los componentes de gráficas y podrían
   probarse solas.
--------------------------------------------------------------------------- */

import { MESES, TIPO_COLOR, TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import type { ReporteCancelado, ReporteMensual } from "@/lib/reportes";
import type { Factura } from "@/lib/facturasShared";

const num = (v: string | number | undefined) =>
  typeof v === "number" ? v : parseFloat(v ?? "0") || 0;

/* -------------------------------------------------------------------------- */
/* Serie mensual: monto y conteo, año actual contra el anterior               */
/* -------------------------------------------------------------------------- */

export type PuntoMes = {
  mes: string;
  mesNum: number;
  monto: number;
  facturas: number;
  montoAnterior: number;
};

export function serieMensual(
  actual: ReporteMensual[],
  anterior: ReporteMensual[]
): PuntoMes[] {
  const acc = MESES.map((mes, i) => ({
    mes,
    mesNum: i + 1,
    monto: 0,
    facturas: 0,
    montoAnterior: 0,
  }));

  for (const r of actual) {
    const i = (parseInt(r.Mes, 10) || 0) - 1;
    if (i < 0 || i > 11) continue;
    acc[i].monto += num(r.TotalFacturas);
    acc[i].facturas += num(r.NumFacturas);
  }
  for (const r of anterior) {
    const i = (parseInt(r.Mes, 10) || 0) - 1;
    if (i < 0 || i > 11) continue;
    acc[i].montoAnterior += num(r.TotalFacturas);
  }

  return acc;
}

/* -------------------------------------------------------------------------- */
/* Vigentes vs canceladas por mes                                             */
/* -------------------------------------------------------------------------- */

export type PuntoEstatus = {
  mes: string;
  mesNum: number;
  vigentes: number;
  canceladas: number;
};

/**
 * `FacturasEjercicio` (`emitidas`) y `CanceladosEjercicioMes` (`canceladas`)
 * son dos consultas DISJUNTAS, no un total y un subconjunto: la primera trae
 * `estatussat != 'Cancelado'` y la segunda `estatussat = 'Cancelado'` (ver
 * `searchReporteAnual()` en el DAO). Por eso "vigentes" se suma directo, sin
 * restar - restar aquí sería descontar canceladas dos veces, ya que
 * `emitidas` nunca las incluyó.
 */
export function serieEstatus(
  emitidas: ReporteMensual[],
  canceladas: ReporteCancelado[]
): PuntoEstatus[] {
  const acc = MESES.map((mes, i) => ({
    mes,
    mesNum: i + 1,
    vigentes: 0,
    canceladas: 0,
  }));

  for (const r of emitidas) {
    const i = (parseInt(r.Mes, 10) || 0) - 1;
    if (i >= 0 && i <= 11) acc[i].vigentes += num(r.NumFacturas);
  }
  for (const r of canceladas) {
    const i = (parseInt(r.Mes, 10) || 0) - 1;
    if (i >= 0 && i <= 11) acc[i].canceladas += num(r.TimbradosCancelados);
  }

  return acc;
}

/* -------------------------------------------------------------------------- */
/* Distribución por tipo de comprobante                                       */
/* -------------------------------------------------------------------------- */

export type SegmentoTipo = {
  tipo: string;
  label: string;
  facturas: number;
  monto: number;
  color: string;
};

export function porTipoComprobante(datos: ReporteMensual[]): SegmentoTipo[] {
  const acc: Record<string, { facturas: number; monto: number }> = {};

  for (const r of datos) {
    const t = r.TipoComprobante;
    acc[t] = acc[t] ?? { facturas: 0, monto: 0 };
    acc[t].facturas += num(r.NumFacturas);
    acc[t].monto += num(r.TotalFacturas);
  }

  // Orden fijo del catálogo: el color sigue al tipo, nunca a su tamaño.
  return TIPO_ORDEN.filter((t) => (acc[t]?.facturas ?? 0) > 0).map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo] ?? tipo,
    facturas: acc[tipo].facturas,
    monto: acc[tipo].monto,
    color: TIPO_COLOR[tipo] ?? "var(--series-1)",
  }));
}

/* -------------------------------------------------------------------------- */
/* Bloques que salen del detalle del mes                                      */
/* -------------------------------------------------------------------------- */

const vigente = (f: Factura) => f.EstatusSat !== "Cancelado";

export type Receptor = { rfc: string; nombre: string; monto: number; facturas: number };

/** Top de clientes por monto facturado, ignorando las canceladas. */
export function topReceptores(detalle: Factura[], limite = 8) {
  const acc = new Map<string, Receptor>();

  for (const f of detalle.filter(vigente)) {
    const clave = f.RfcReceptor || f.NombreReceptor;
    const previo = acc.get(clave) ?? {
      rfc: f.RfcReceptor || "—",
      nombre: f.NombreReceptor || "Sin nombre",
      monto: 0,
      facturas: 0,
    };
    previo.monto += num(f.Total);
    previo.facturas += 1;
    acc.set(clave, previo);
  }

  const todos = [...acc.values()].sort((a, b) => b.monto - a.monto);
  const total = todos.reduce((s, r) => s + r.monto, 0);

  return {
    top: todos.slice(0, limite),
    clientes: todos.length,
    total,
    /** Porcentaje del monto que aporta el cliente más grande. */
    concentracion: total > 0 && todos[0] ? (todos[0].monto / total) * 100 : 0,
    /** Porcentaje que aportan los 3 más grandes. */
    concentracionTop3:
      total > 0
        ? (todos.slice(0, 3).reduce((s, r) => s + r.monto, 0) / total) * 100
        : 0,
  };
}

export type Rebanada = { clave: string; label: string; facturas: number; monto: number };

export function porClave(
  detalle: Factura[],
  campo: (f: Factura) => string,
  etiqueta: (clave: string) => string
): Rebanada[] {
  const acc = new Map<string, Rebanada>();

  for (const f of detalle.filter(vigente)) {
    const clave = campo(f) || "—";
    const previo = acc.get(clave) ?? {
      clave,
      label: etiqueta(clave),
      facturas: 0,
      monto: 0,
    };
    previo.facturas += 1;
    previo.monto += num(f.Total);
    acc.set(clave, previo);
  }

  return [...acc.values()].sort((a, b) => b.monto - a.monto);
}

export type PuntoDia = { dia: number; etiqueta: string; facturas: number; monto: number };

/** Actividad día por día del mes del detalle. */
export function actividadDiaria(
  detalle: Factura[],
  anio: number,
  mes: number
): PuntoDia[] {
  const dias = new Date(anio, mes, 0).getDate();
  const acc: PuntoDia[] = Array.from({ length: dias }, (_, i) => ({
    dia: i + 1,
    etiqueta: String(i + 1),
    facturas: 0,
    monto: 0,
  }));

  for (const f of detalle.filter(vigente)) {
    const fecha = (f.FechaEmision || f.FechaReg || "").slice(0, 10);
    const dia = parseInt(fecha.slice(8, 10), 10);
    if (dia >= 1 && dia <= dias) {
      acc[dia - 1].facturas += 1;
      acc[dia - 1].monto += num(f.Total);
    }
  }

  return acc;
}

/** Estatus ante el SAT del mes: lo que conviene revisar. */
export function resumenEstatus(detalle: Factura[]) {
  const acc = { vigentes: 0, canceladas: 0, sinConfirmar: 0 };

  for (const f of detalle) {
    if (f.EstatusSat === "Cancelado") acc.canceladas += 1;
    else if (f.EstatusSat === "Vigente") acc.vigentes += 1;
    else acc.sinConfirmar += 1;
  }

  return acc;
}

/* -------------------------------------------------------------------------- */
/* Totales del ejercicio                                                      */
/* -------------------------------------------------------------------------- */

export function totalesEjercicio(
  serie: PuntoMes[],
  estatus: PuntoEstatus[],
  hastaMes?: number
) {
  const corte = hastaMes ? serie.filter((p) => p.mesNum === hastaMes) : serie;
  const corteEstatus = hastaMes
    ? estatus.filter((p) => p.mesNum === hastaMes)
    : estatus;

  const monto = corte.reduce((s, p) => s + p.monto, 0);
  const montoAnterior = corte.reduce((s, p) => s + p.montoAnterior, 0);
  // `facturas` sale de `serie`, que a su vez sale de `emitidas`
  // (FacturasEjercicio) - esa consulta YA excluye canceladas (ver
  // `serieEstatus`), asi que es un conteo de vigentes, no del total
  // realmente emitido. Para "Facturas emitidas" y el % de cancelación hace
  // falta sumarle las canceladas; para "Ticket promedio" en cambio SÍ es lo
  // correcto (el ticket se calcula solo sobre comprobantes vigentes).
  const vigentes = corte.reduce((s, p) => s + p.facturas, 0);
  const canceladas = corteEstatus.reduce((s, p) => s + p.canceladas, 0);
  const totalEmitidas = vigentes + canceladas;

  return {
    monto,
    montoAnterior,
    facturas: vigentes,
    totalEmitidas,
    canceladas,
    ticket: vigentes > 0 ? monto / vigentes : 0,
    tasaCancelacion: totalEmitidas > 0 ? (canceladas / totalEmitidas) * 100 : 0,
    /** Variación contra el mismo corte del año anterior, en %. */
    variacion:
      montoAnterior > 0 ? ((monto - montoAnterior) / montoAnterior) * 100 : null,
  };
}
