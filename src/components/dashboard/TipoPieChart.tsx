"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  type PieLabelRenderProps,
} from "recharts";

type Segmento = { tipo: string; label: string; facturas: number; color: string };

export function TipoPieChart({ data }: { data: Segmento[] }) {
  const total = data.reduce((acc, d) => acc + d.facturas, 0);

  if (data.length === 0 || total === 0) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          Distribución por tipo
        </h2>
        <p className="py-10 text-center text-sm text-neutral-500">
          Sin facturas en este periodo.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold text-neutral-900">
        Distribución por tipo
      </h2>
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="facturas"
              nameKey="label"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={2}
              stroke="var(--chart-surface)"
              strokeWidth={2}
              isAnimationActive={false}
              label={(props) => renderPercentLabel(props, total)}
              labelLine={{ stroke: "var(--chart-baseline)" }}
            >
              {data.map((seg) => (
                <Cell key={seg.tipo} fill={seg.color} />
              ))}
            </Pie>
            <Tooltip content={<PieTooltip total={total} />} />
            <Legend
              verticalAlign="bottom"
              formatter={(value) => (
                <span className="text-sm text-neutral-700">{value}</span>
              )}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// Etiqueta directa en tinta neutra (nunca del color del segmento) - ver
// "Text never wears the data color" en la skill de dataviz.
function renderPercentLabel(props: PieLabelRenderProps, total: number) {
  const cx = Number(props.cx);
  const cy = Number(props.cy);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius);
  const value = Number(props.value ?? 0);

  const RADIAN = Math.PI / 180;
  const radius = outerRadius + 18;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  const pct = Math.round((value / total) * 100);

  return (
    <text
      x={x}
      y={y}
      fill="var(--chart-ink-secondary)"
      fontSize={12}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
    >
      {pct}%
    </text>
  );
}

function PieTooltip({
  active,
  payload,
  total,
}: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  total: number;
}) {
  if (!active || !payload?.length) return null;
  const { name, value } = payload[0];

  return (
    <div className="rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-sm">
      <p className="font-medium text-neutral-900">{name}</p>
      <p className="text-neutral-600">
        {value} facturas · {Math.round((value / total) * 100)}%
      </p>
    </div>
  );
}
