"use client";

import { useEffect, useState } from "react";
import type { Emisor } from "@/lib/emisores";
import type { DashboardData } from "@/lib/reportes";
import { MESES, porMes, porTipo, totalFacturas } from "@/lib/reportesUtils";
import { FilterBar, type Filtros } from "@/components/dashboard/FilterBar";
import { StatTile } from "@/components/dashboard/StatTile";
import { MonthlyBarChart } from "@/components/dashboard/MonthlyBarChart";
import { TipoPieChart } from "@/components/dashboard/TipoPieChart";
import { EmisorBarChart } from "@/components/dashboard/EmisorBarChart";

export default function DashboardPage() {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [filtros, setFiltrosState] = useState<Filtros>({
    rfc: "",
    anio: new Date().getFullYear(),
    mes: "",
    tipo: "TODO",
  });
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  // El loading se activa aqui (evento del filtro), no dentro del efecto -
  // llamar setState de forma sincrona al inicio de un efecto dispara
  // renders en cascada innecesarios.
  function handleFiltrosChange(next: Filtros) {
    setLoading(true);
    setFiltrosState(next);
  }

  useEffect(() => {
    fetch("/api/emisores")
      .then((res) => res.json())
      .then((body) => setEmisores(body.emisores ?? []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams({
      rfc: filtros.rfc,
      anio: String(filtros.anio),
      mes: filtros.mes,
      tipo: filtros.tipo,
    });

    fetch(`/api/dashboard?${params.toString()}`)
      .then((res) => res.json())
      .then((body: DashboardData) => setData(body))
      .finally(() => setLoading(false));
  }, [filtros]);

  const facturasEjercicio = data?.facturasEjercicio ?? [];
  const total = totalFacturas(facturasEjercicio);
  const mensual = porMes(facturasEjercicio);
  const tipos = porTipo(facturasEjercicio);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Inicio</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Resumen de facturas emitidas.
        </p>
      </div>

      <FilterBar emisores={emisores} filtros={filtros} onChange={handleFiltrosChange} />

      {loading ? (
        <p className="text-sm text-neutral-500">Cargando...</p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatTile
              label={
                filtros.mes
                  ? `Facturas en ${MESES[parseInt(filtros.mes, 10) - 1]} ${filtros.anio}`
                  : `Facturas en ${filtros.anio}`
              }
              value={String(total)}
            />
            <StatTile
              label="Emisores con actividad"
              value={String(data?.emisores.length ?? 0)}
            />
          </div>

          <div
            className={`grid grid-cols-1 gap-4 ${filtros.mes ? "" : "lg:grid-cols-2"}`}
          >
            {!filtros.mes && <MonthlyBarChart data={mensual} />}
            <TipoPieChart data={tipos} />
          </div>

          {filtros.rfc === "" && (
            <EmisorBarChart data={data?.emisores ?? []} />
          )}
        </>
      )}
    </div>
  );
}
