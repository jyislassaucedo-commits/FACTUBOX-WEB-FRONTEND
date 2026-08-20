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

type Punto = { mes: string; facturas: number };

export function MonthlyBarChart({ data }: { data: Punto[] }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">
        Facturas por mes
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
            <CartesianGrid
              vertical={false}
              stroke="var(--chart-gridline)"
              strokeWidth={1}
            />
            <XAxis
              dataKey="mes"
              tickLine={false}
              axisLine={{ stroke: "var(--chart-baseline)" }}
              tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--chart-muted)", fontSize: 12 }}
              width={36}
            />
            <Tooltip
              cursor={{ fill: "var(--chart-gridline)", opacity: 0.4 }}
              content={<ChartTooltip />}
            />
            <Bar
              dataKey="facturas"
              fill="var(--series-1)"
              radius={[4, 4, 0, 0]}
              maxBarSize={24}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-neutral-900">{label}</p>
      <p className="text-neutral-600">{payload[0].value} facturas</p>
    </div>
  );
}
