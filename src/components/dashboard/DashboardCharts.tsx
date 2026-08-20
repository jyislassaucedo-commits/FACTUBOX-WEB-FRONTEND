"use client";

import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { ChartCard, VizLeyenda, VizTooltip } from "./ChartCard";
import { money } from "@/lib/cfdi";
import { MESES } from "@/lib/reportesUtils";
import type {
  PuntoDia,
  PuntoEstatus,
  PuntoMes,
  Rebanada,
  SegmentoTipo,
} from "@/lib/dashboardCalculos";
import type { Receptor } from "@/lib/dashboardCalculos";

/** Ejes en pesos: $1.2M / $340k, para no llenar el eje de ceros. */
function montoCorto(v: number) {
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 1_000) return `$${Math.round(v / 1_000)}k`;
  return `$${Math.round(v)}`;
}

const EJE = { fill: "var(--chart-muted)", fontSize: 11.5 };
const REJILLA = { stroke: "var(--chart-gridline)", strokeWidth: 1 };

/* ========================================================================== */
/* Monto facturado por mes — año actual contra el anterior                    */
/* ========================================================================== */

export function MontoPorMes({
  serie,
  anio,
  mesActivo,
  onMes,
}: {
  serie: PuntoMes[];
  anio: number;
  /** Mes resaltado por el filtro cruzado, o null. */
  mesActivo: number | null;
  onMes: (mes: number | null) => void;
}) {
  const hayAnterior = serie.some((p) => p.montoAnterior > 0);

  return (
    <ChartCard
      titulo="Cuánto facturaste por mes"
      descripcion={
        hayAnterior
          ? `${anio} contra ${anio - 1}. Haz clic en un mes para filtrar todo el tablero.`
          : "Haz clic en un mes para filtrar todo el tablero."
      }
      alto={280}
      leyenda={
        hayAnterior ? (
          <VizLeyenda
            series={[
              { label: String(anio), color: "var(--series-1)" },
              { label: String(anio - 1), color: "var(--series-4)" },
            ]}
          />
        ) : undefined
      }
      tabla={{
        columnas: hayAnterior
          ? ["Mes", "Facturas", `Monto ${anio}`, `Monto ${anio - 1}`]
          : ["Mes", "Facturas", "Monto"],
        filas: serie
          .filter((p) => p.facturas > 0 || p.montoAnterior > 0)
          .map((p) =>
            hayAnterior
              ? [p.mes, p.facturas, money(p.monto), money(p.montoAnterior)]
              : [p.mes, p.facturas, money(p.monto)]
          ),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={serie}
          margin={{ top: 4, right: 4, left: 4, bottom: 0 }}
          barGap={2}
        >
          <CartesianGrid vertical={false} {...REJILLA} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tick={EJE}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={EJE}
            width={52}
            tickFormatter={montoCorto}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.35 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PuntoMes;
              return (
                <VizTooltip
                  titulo={`${label} ${anio}`}
                  filas={[
                    { label: "Facturado", valor: money(p.monto), color: "var(--series-1)" },
                    { label: "Facturas", valor: String(p.facturas) },
                    ...(hayAnterior
                      ? [
                          {
                            label: `Mismo mes ${anio - 1}`,
                            valor: money(p.montoAnterior),
                            color: "var(--series-4)",
                          },
                        ]
                      : []),
                  ]}
                />
              );
            }}
          />
          {hayAnterior && (
            <Bar
              dataKey="montoAnterior"
              fill="var(--series-4)"
              radius={[4, 4, 0, 0]}
              maxBarSize={14}
              isAnimationActive={false}
            />
          )}
          {/* El clic va en la barra, no en el gráfico: en Recharts 3 el
              handler del <BarChart> ya no expone activePayload. */}
          <Bar
            dataKey="monto"
            fill="var(--series-1)"
            radius={[4, 4, 0, 0]}
            maxBarSize={hayAnterior ? 14 : 26}
            isAnimationActive={false}
            cursor="pointer"
            onClick={(entrada: unknown) => {
              const punto = entrada as { mesNum?: number; payload?: PuntoMes };
              const mes = punto?.mesNum ?? punto?.payload?.mesNum;
              if (mes) onMes(mes === mesActivo ? null : mes);
            }}
          >
            {serie.map((p) => (
              <Cell
                key={p.mesNum}
                fillOpacity={mesActivo === null || mesActivo === p.mesNum ? 1 : 0.28}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ========================================================================== */
/* Vigentes vs canceladas por mes                                             */
/* ========================================================================== */

export function EstatusPorMes({ serie }: { serie: PuntoEstatus[] }) {
  return (
    <ChartCard
      titulo="Vigentes y canceladas"
      descripcion="Comprobantes por mes según su estatus ante el SAT."
      alto={252}
      leyenda={
        <VizLeyenda
          series={[
            { label: "Vigentes", color: "var(--ok)" },
            { label: "Canceladas", color: "var(--danger)" },
          ]}
        />
      }
      tabla={{
        columnas: ["Mes", "Vigentes", "Canceladas", "% cancelado"],
        filas: serie
          .filter((p) => p.vigentes + p.canceladas > 0)
          .map((p) => {
            const total = p.vigentes + p.canceladas;
            return [
              p.mes,
              p.vigentes,
              p.canceladas,
              `${total > 0 ? ((p.canceladas / total) * 100).toFixed(1) : "0.0"}%`,
            ];
          }),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} {...REJILLA} />
          <XAxis
            dataKey="mes"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tick={EJE}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={EJE}
            width={36}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.35 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PuntoEstatus;
              return (
                <VizTooltip
                  titulo={String(label)}
                  filas={[
                    { label: "Vigentes", valor: String(p.vigentes), color: "var(--ok)" },
                    {
                      label: "Canceladas",
                      valor: String(p.canceladas),
                      color: "var(--danger)",
                    },
                  ]}
                />
              );
            }}
          />
          {/* Apiladas: el hueco de 2px lo da el stroke del color de superficie. */}
          <Bar
            dataKey="vigentes"
            stackId="e"
            fill="var(--ok)"
            maxBarSize={26}
            isAnimationActive={false}
          />
          <Bar
            dataKey="canceladas"
            stackId="e"
            fill="var(--danger)"
            radius={[4, 4, 0, 0]}
            maxBarSize={26}
            stroke="var(--chart-surface)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ========================================================================== */
/* Distribución por tipo de comprobante                                       */
/* ========================================================================== */

export function TipoComprobante({
  segmentos,
  tipoActivo,
  onTipo,
}: {
  segmentos: SegmentoTipo[];
  tipoActivo: string;
  onTipo: (tipo: string) => void;
}) {
  const total = segmentos.reduce((s, d) => s + d.facturas, 0);

  return (
    <ChartCard
      titulo="Qué tipo de comprobante emites"
      descripcion="Haz clic en un tipo para filtrar el tablero."
      alto={252}
      leyenda={
        <VizLeyenda series={segmentos.map((s) => ({ label: s.label, color: s.color }))} />
      }
      tabla={{
        columnas: ["Tipo", "Facturas", "Participación", "Monto"],
        filas: segmentos.map((s) => [
          s.label,
          s.facturas,
          `${((s.facturas / total) * 100).toFixed(1)}%`,
          money(s.monto),
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={segmentos}
            dataKey="facturas"
            nameKey="label"
            innerRadius={52}
            outerRadius={84}
            paddingAngle={2}
            stroke="var(--chart-surface)"
            strokeWidth={2}
            isAnimationActive={false}
            onClick={(_, indice) => {
              const seg = segmentos[indice];
              if (seg) onTipo(seg.tipo === tipoActivo ? "TODO" : seg.tipo);
            }}
            cursor="pointer"
          >
            {segmentos.map((seg) => (
              <Cell
                key={seg.tipo}
                fill={seg.color}
                fillOpacity={tipoActivo === "TODO" || tipoActivo === seg.tipo ? 1 : 0.28}
              />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const seg = payload[0].payload as SegmentoTipo;
              return (
                <VizTooltip
                  titulo={seg.label}
                  filas={[
                    { label: "Facturas", valor: String(seg.facturas), color: seg.color },
                    {
                      label: "Participación",
                      valor: `${((seg.facturas / total) * 100).toFixed(1)}%`,
                    },
                    { label: "Monto", valor: money(seg.monto) },
                  ]}
                />
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ========================================================================== */
/* Top de clientes                                                            */
/* ========================================================================== */

export function TopClientes({
  receptores,
  periodo,
}: {
  receptores: Receptor[];
  periodo: string;
}) {
  const datos = receptores.map((r) => ({
    ...r,
    // Nombres largos truncados en el eje; el completo va en el tooltip.
    // Se recorta sin dejar el espacio final: si queda, Recharts parte la
    // etiqueta en dos renglones y las filas dejan de alinearse.
    corto:
      r.nombre.length > 18 ? `${r.nombre.slice(0, 17).trimEnd()}…` : r.nombre,
  }));

  return (
    <ChartCard
      titulo="Tus clientes más grandes"
      descripcion={`Por monto facturado en ${periodo}, sin contar canceladas.`}
      alto={Math.max(200, datos.length * 34 + 30)}
      vacio="Sin facturas vigentes en el mes."
      tabla={{
        columnas: ["Cliente", "RFC", "Facturas", "Monto"],
        filas: datos.map((r) => [r.nombre, r.rfc, r.facturas, money(r.monto)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} {...REJILLA} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={EJE}
            tickFormatter={montoCorto}
          />
          <YAxis
            type="category"
            dataKey="corto"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tick={EJE}
            width={168}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.35 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as Receptor;
              return (
                <VizTooltip
                  titulo={r.nombre}
                  filas={[
                    { label: "Monto", valor: money(r.monto), color: "var(--series-1)" },
                    { label: "Facturas", valor: String(r.facturas) },
                    { label: "RFC", valor: r.rfc },
                  ]}
                />
              );
            }}
          />
          {/* Una sola serie → un solo color. Nunca una rampa por tamaño. */}
          <Bar
            dataKey="monto"
            fill="var(--series-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={18}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ========================================================================== */
/* Actividad por día                                                          */
/* ========================================================================== */

export function ActividadDiaria({
  serie,
  periodo,
}: {
  serie: PuntoDia[];
  periodo: string;
}) {
  return (
    <ChartCard
      titulo="Actividad día por día"
      descripcion={`Facturas emitidas en ${periodo}.`}
      alto={200}
      vacio="Sin actividad en el mes."
      tabla={{
        columnas: ["Día", "Facturas", "Monto"],
        filas: serie
          .filter((p) => p.facturas > 0)
          .map((p) => [p.etiqueta, p.facturas, money(p.monto)]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={serie} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
          <CartesianGrid vertical={false} {...REJILLA} />
          <XAxis
            dataKey="etiqueta"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tick={EJE}
            interval={2}
          />
          <YAxis
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={EJE}
            width={30}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.35 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as PuntoDia;
              return (
                <VizTooltip
                  titulo={`Día ${p.dia}`}
                  filas={[
                    { label: "Facturas", valor: String(p.facturas), color: "var(--series-1)" },
                    { label: "Monto", valor: money(p.monto) },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="facturas"
            fill="var(--series-1)"
            radius={[3, 3, 0, 0]}
            maxBarSize={14}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/* ========================================================================== */
/* Formas / métodos de pago                                                   */
/* ========================================================================== */

export function Rebanadas({
  titulo,
  descripcion,
  datos,
  vacio,
}: {
  titulo: string;
  descripcion: string;
  datos: Rebanada[];
  vacio?: string;
}) {
  const total = datos.reduce((s, d) => s + d.monto, 0);
  const datos6 = plegarEnOtros(datos, 6);

  // Una sola categoría con una sola barra no dice nada que el número no diga:
  // se muestra como dato, no como gráfica (anti-patrón "one-bar bar chart").
  if (datos.length === 1) {
    const unico = datos[0];
    return (
      <ChartCard
        titulo={titulo}
        descripcion={descripcion}
        alto={96}
        vacio={vacio}
        tabla={{
          columnas: ["Concepto", "Facturas", "Monto", "Participación"],
          filas: [[unico.label, unico.facturas, money(unico.monto), "100.0%"]],
        }}
      >
        <div className="flex h-full flex-col justify-center">
          <p className="text-[13px] font-semibold text-ink">{unico.label}</p>
          <p className="mt-1 text-2xl font-bold leading-none tracking-tight text-ink">
            {money(unico.monto)}
          </p>
          <p className="mt-1.5 text-[11.5px] text-ink-3">
            {unico.facturas} comprobante{unico.facturas === 1 ? "" : "s"} · el 100% del
            periodo
          </p>
        </div>
      </ChartCard>
    );
  }

  return (
    <ChartCard
      titulo={titulo}
      descripcion={descripcion}
      alto={Math.max(160, datos6.length * 32 + 26)}
      vacio={vacio}
      tabla={{
        columnas: ["Concepto", "Facturas", "Monto", "Participación"],
        filas: datos.map((d) => [
          d.label,
          d.facturas,
          money(d.monto),
          `${total > 0 ? ((d.monto / total) * 100).toFixed(1) : "0.0"}%`,
        ]),
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={datos6}
          layout="vertical"
          margin={{ top: 0, right: 12, left: 4, bottom: 0 }}
        >
          <CartesianGrid horizontal={false} {...REJILLA} />
          <XAxis
            type="number"
            tickLine={false}
            axisLine={false}
            tick={EJE}
            tickFormatter={montoCorto}
          />
          <YAxis
            type="category"
            dataKey="label"
            tickLine={false}
            axisLine={{ stroke: "var(--chart-baseline)" }}
            tick={EJE}
            width={130}
          />
          <Tooltip
            cursor={{ fill: "var(--chart-gridline)", opacity: 0.35 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload as Rebanada;
              return (
                <VizTooltip
                  titulo={d.label}
                  filas={[
                    { label: "Monto", valor: money(d.monto), color: "var(--series-1)" },
                    { label: "Facturas", valor: String(d.facturas) },
                    {
                      label: "Participación",
                      valor: `${total > 0 ? ((d.monto / total) * 100).toFixed(1) : "0.0"}%`,
                    },
                  ]}
                />
              );
            }}
          />
          <Bar
            dataKey="monto"
            fill="var(--series-1)"
            radius={[0, 4, 4, 0]}
            maxBarSize={16}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}

/** Más de N categorías se doblan en "Otros" en vez de inventar colores. */
function plegarEnOtros(datos: Rebanada[], n: number): Rebanada[] {
  if (datos.length <= n) return datos;
  const cabeza = datos.slice(0, n - 1);
  const cola = datos.slice(n - 1);
  return [
    ...cabeza,
    {
      clave: "otros",
      label: `Otros (${cola.length})`,
      facturas: cola.reduce((s, d) => s + d.facturas, 0),
      monto: cola.reduce((s, d) => s + d.monto, 0),
    },
  ];
}

export { MESES };
