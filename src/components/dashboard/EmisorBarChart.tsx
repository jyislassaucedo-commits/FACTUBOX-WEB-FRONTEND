"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReporteEmisor } from "@/lib/reportes";

export function EmisorBarChart({ data }: { data: ReporteEmisor[] }) {
  const top = [...data].sort((a, b) => b.NumFacturas - a.NumFacturas).slice(0, 8);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">
        Facturas por emisor
      </h2>
      {top.length === 0 ? (
        <p className="py-10 text-center text-sm text-neutral-500">
          Sin facturas en este periodo.
        </p>
      ) : (
        <div style={{ height: Math.max(top.length * 40, 120) }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={top}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 8, bottom: 0 }}
            >
              <CartesianGrid
                horizontal={false}
                stroke="var(--chart-gridline)"
                strokeWidth={1}
              />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={{ stroke: "var(--chart-baseline)" }}
                tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              />
              <YAxis
                type="category"
                dataKey="Rfc"
                tickLine={false}
                axisLine={false}
                width={90}
                tick={{ fill: "var(--chart-ink-secondary)", fontSize: 12 }}
              />
              <Tooltip
                cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }}
                content={<ChartTooltip />}
              />
              <Bar
                dataKey="NumFacturas"
                fill="var(--series-1)"
                radius={[0, 4, 4, 0]}
                maxBarSize={20}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: ReporteEmisor }[];
}) {
  if (!active || !payload?.length) return null;
  const emisor = payload[0].payload;

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-neutral-900">{emisor.Nombre}</p>
      <p className="text-neutral-600">{emisor.Rfc}</p>
      <p className="text-neutral-600">{emisor.NumFacturas} facturas</p>
    </div>
  );
}
