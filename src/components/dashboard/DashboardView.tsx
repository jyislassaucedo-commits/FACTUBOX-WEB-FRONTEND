"use client";

import { useMemo, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Card,
  CardBody,
  CardHeader,
  Note,
  Pill,
  Select,
  buttonClass,
  cx,
} from "@/components/ui";
import { fechaHora, money } from "@/lib/cfdi";
import { tipoSerie } from "@/lib/emisorNav";
import { MESES, TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import { FORMAS_PAGO, METODOS_PAGO } from "@/lib/catalogosSat";
import {
  actividadDiaria,
  porClave,
  porTipoComprobante,
  resumenEstatus,
  serieEstatus,
  serieMensual,
  topReceptores,
  totalesEjercicio,
} from "@/lib/dashboardCalculos";
import {
  ActividadDiaria,
  EstatusPorMes,
  MontoPorMes,
  Rebanadas,
  TipoComprobante,
  TopClientes,
} from "./DashboardCharts";
import type { DashboardData, DashboardFilters } from "@/lib/reportes";
import type { Emisor } from "@/lib/emisores";
import { TIMBRES_BAJOS, type Timbres } from "@/lib/timbresShared";

export function DashboardView({
  data,
  emisores,
  filtros,
  timbres,
}: {
  data: DashboardData;
  emisores: Emisor[];
  filtros: DashboardFilters;
  /** Saldo de la cuenta; null si no se pudo consultar. */
  timbres: Timbres | null;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();

  /** Los filtros viven en la URL: la vista es compartible y Atrás funciona. */
  function aplicar(cambios: Partial<DashboardFilters>) {
    const nuevos = { ...filtros, ...cambios };
    const params = new URLSearchParams({
      rfc: nuevos.rfc,
      anio: String(nuevos.anio),
      mes: nuevos.mes,
      tipo: nuevos.tipo,
    });
    startTransition(() => router.replace(`/?${params.toString()}`));
  }

  const serie = useMemo(
    () => serieMensual(data.facturasEjercicio, data.anioAnterior),
    [data.facturasEjercicio, data.anioAnterior]
  );
  const estatus = useMemo(
    () => serieEstatus(data.facturasEjercicio, data.canceladosEjercicio),
    [data.facturasEjercicio, data.canceladosEjercicio]
  );
  const tipos = useMemo(
    () => porTipoComprobante(data.facturasEjercicio),
    [data.facturasEjercicio]
  );

  const mesActivo = filtros.mes ? parseInt(filtros.mes, 10) : null;
  const totales = useMemo(
    () => totalesEjercicio(serie, estatus, mesActivo ?? undefined),
    [serie, estatus, mesActivo]
  );

  const clientes = useMemo(() => topReceptores(data.detalle), [data.detalle]);
  const diaria = useMemo(
    () => actividadDiaria(data.detalle, data.periodoDetalle.anio, data.periodoDetalle.mes),
    [data.detalle, data.periodoDetalle]
  );
  const formas = useMemo(
    () =>
      porClave(
        data.detalle,
        (f) => f.FormaPago,
        (c) => FORMAS_PAGO.find((x) => x.value === c)?.label ?? `Forma ${c}`
      ),
    [data.detalle]
  );
  const metodos = useMemo(
    () =>
      porClave(
        data.detalle,
        (f) => f.MetodoPago,
        (c) => METODOS_PAGO.find((x) => x.value === c)?.label ?? `Método ${c}`
      ),
    [data.detalle]
  );
  const estatusDetalle = useMemo(() => resumenEstatus(data.detalle), [data.detalle]);

  const timbresUsados = data.timbres.reduce(
    (s, t) => s + (parseInt(t.TimbradosUsados, 10) || 0),
    0
  );
  const timbresCancelados = data.timbres.reduce(
    (s, t) => s + (parseInt(t.TimbradosCancelados, 10) || 0),
    0
  );

  const periodoDetalle = `${MESES[data.periodoDetalle.mes - 1]} ${data.periodoDetalle.anio}`;
  const etiquetaCorte = mesActivo ? `${MESES[mesActivo - 1]} ${filtros.anio}` : String(filtros.anio);

  const ppd = metodos.find((m) => m.clave === "PPD");
  const ultimas = useMemo(
    () =>
      [...data.detalle]
        .sort((a, b) =>
          (b.FechaEmision || b.FechaReg).localeCompare(a.FechaEmision || a.FechaReg)
        )
        .slice(0, 6),
    [data.detalle]
  );

  const anioActual = new Date().getFullYear();
  // El filtro puede traer un año fuera de la ventana (URL vieja, compartida
  // o escrita a mano): si no se agrega a la lista, el <select> no encuentra
  // su value y el navegador cae en la primera opción, mostrando un año
  // distinto al que en realidad está filtrado.
  const anios = Array.from(
    new Set([
      ...Array.from({ length: 5 }, (_, i) => anioActual - i),
      filtros.anio,
    ])
  ).sort((a, b) => b - a);

  return (
    <div className="space-y-4">
      {/* ---------- Una sola fila de filtros para todo el tablero ---------- */}
      <Card>
        <CardBody className="flex flex-wrap items-end gap-3 py-3.5">
          <Filtro etiqueta="Emisor" ancho="w-[230px]">
            <Select value={filtros.rfc} onChange={(e) => aplicar({ rfc: e.target.value })}>
              <option value="">Todos los emisores</option>
              {emisores.map((e) => (
                <option key={e.Rfc} value={e.Rfc}>
                  {e.Nombre}
                </option>
              ))}
            </Select>
          </Filtro>

          <Filtro etiqueta="Año" ancho="w-[110px]">
            <Select
              value={String(filtros.anio)}
              onChange={(e) => aplicar({ anio: parseInt(e.target.value, 10) })}
            >
              {anios.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Select>
          </Filtro>

          <Filtro etiqueta="Mes" ancho="w-[150px]">
            <Select value={filtros.mes} onChange={(e) => aplicar({ mes: e.target.value })}>
              <option value="">Todo el año</option>
              {MESES.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </Select>
          </Filtro>

          <Filtro etiqueta="Tipo de comprobante" ancho="w-[170px]">
            <Select value={filtros.tipo} onChange={(e) => aplicar({ tipo: e.target.value })}>
              <option value="TODO">Todos los tipos</option>
              {TIPO_ORDEN.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </Select>
          </Filtro>

          {(filtros.mes || filtros.tipo !== "TODO" || filtros.rfc) && (
            <button
              type="button"
              onClick={() => aplicar({ rfc: "", mes: "", tipo: "TODO" })}
              className="focus-brand mb-1 rounded text-[12.5px] font-medium text-brand hover:underline"
            >
              Limpiar filtros
            </button>
          )}
        </CardBody>
      </Card>

      {/* Al refiltrar se sostiene el render anterior atenuado: nada de saltos. */}
      <div className={cx("space-y-4 transition", pendiente && "pointer-events-none opacity-60")}>
        {/* ---------- Números principales ---------- */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Tile
            etiqueta={`Facturado en ${etiquetaCorte}`}
            valor={money(totales.monto)}
            nota={
              totales.variacion === null
                ? "sin comparativo del año anterior"
                : `${totales.variacion >= 0 ? "▲" : "▼"} ${Math.abs(totales.variacion).toFixed(1)}% vs ${filtros.anio - 1}`
            }
            tono={
              totales.variacion === null
                ? undefined
                : totales.variacion >= 0
                  ? "ok"
                  : "warn"
            }
            destacado
          />
          <Tile
            etiqueta="Facturas emitidas"
            valor={String(totales.totalEmitidas)}
            nota={`${timbresUsados} timbres usados en ${filtros.anio}`}
          />
          <Tile
            etiqueta="Ticket promedio"
            valor={money(totales.ticket)}
            nota="por comprobante vigente"
          />
          <Tile
            etiqueta="Canceladas"
            valor={`${totales.tasaCancelacion.toFixed(1)}%`}
            nota={`${totales.canceladas} de ${totales.totalEmitidas} comprobantes`}
            tono={totales.tasaCancelacion > 10 ? "warn" : undefined}
          />
        </div>

        {/* ---------- Avisos accionables ---------- */}
        {(estatusDetalle.sinConfirmar > 0 || clientes.concentracion > 50) && (
          <div className="grid gap-3 lg:grid-cols-2">
            {estatusDetalle.sinConfirmar > 0 && (
              <Note
                tone="warn"
                title={`${estatusDetalle.sinConfirmar} comprobante(s) sin confirmar ante el SAT`}
              >
                Su estatus quedó guardado como algo distinto de Vigente o Cancelado, casi
                siempre porque al timbrar el SAT todavía no lo había propagado.{" "}
                <Link href="/facturas" className="font-semibold underline">
                  Validarlos en el listado
                </Link>
              </Note>
            )}
            {clientes.concentracion > 50 && (
              <Note tone="info" title="Tu ingreso está concentrado">
                {clientes.top[0]?.nombre} representa el{" "}
                {clientes.concentracion.toFixed(0)}% de lo que facturaste en{" "}
                {periodoDetalle}
                {clientes.clientes > 3 &&
                  `, y los tres mayores el ${clientes.concentracionTop3.toFixed(0)}%`}
                .
              </Note>
            )}
          </div>
        )}

        {/* ---------- Dinero y estatus ---------- */}
        <MontoPorMes
          serie={serie}
          anio={filtros.anio}
          mesActivo={mesActivo}
          onMes={(mes) => aplicar({ mes: mes ? String(mes) : "" })}
        />

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <EstatusPorMes serie={estatus} />
          <TipoComprobante
            segmentos={tipos}
            tipoActivo={filtros.tipo}
            onTipo={(tipo) => aplicar({ tipo })}
          />
        </div>

        {/* ---------- Bloques que salen del detalle del mes ---------- */}
        <div className="flex items-center gap-2 pt-1">
          <h2 className="text-[15px] font-bold tracking-tight text-ink">
            Detalle de {periodoDetalle}
          </h2>
          <Pill>
            {data.detalle.length} comprobante{data.detalle.length === 1 ? "" : "s"}
          </Pill>
          {!filtros.mes && (
            <span className="text-[12px] text-ink-3">
              · el mes más reciente con actividad; elige otro en el filtro
            </span>
          )}
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <TopClientes receptores={clientes.top} periodo={periodoDetalle} />
          <div className="space-y-4">
            <ActividadDiaria serie={diaria} periodo={periodoDetalle} />
            <Rebanadas
              titulo="Cómo te pagan"
              descripcion={`Forma de pago declarada en ${periodoDetalle}.`}
              datos={formas}
              vacio="Sin facturas vigentes en el mes."
            />
          </div>
        </div>

        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Rebanadas
            titulo="Método de pago"
            descripcion="PUE se liquida de una; PPD te obliga a emitir complemento de pago después."
            datos={metodos}
            vacio="Sin facturas vigentes en el mes."
          />

          <Card>
            <CardHeader
              title="Últimas facturas"
              description={`Lo más reciente de ${periodoDetalle}.`}
              action={
                <Link href="/facturas" className={buttonClass("secondary", "sm")}>
                  Ver todas
                </Link>
              }
            />
            {ultimas.length === 0 ? (
              <CardBody>
                <p className="py-8 text-center text-[13px] text-ink-3">
                  Sin facturas en el mes.
                </p>
              </CardBody>
            ) : (
              <ul className="divide-y divide-line-2">
                {ultimas.map((f) => {
                  const tipo = tipoSerie(f.TipoComprobante);
                  const cancelada = f.EstatusSat === "Cancelado";
                  return (
                    <li key={f.Uuid} className="flex items-center gap-3 px-5 py-2.5">
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="font-mono text-[12.5px] font-semibold text-ink">
                            {f.Serie ? `${f.Serie}-${f.Folio}` : f.Folio}
                          </span>
                          <Pill tone={tipo.tone}>{tipo.label}</Pill>
                        </span>
                        <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                          {f.NombreReceptor} · {fechaHora(f.FechaEmision || f.FechaReg)}
                        </span>
                      </span>
                      <span
                        className={cx(
                          "shrink-0 font-mono tabular-nums text-[13px] font-semibold",
                          cancelada ? "text-ink-4 line-through" : "text-ink"
                        )}
                      >
                        {money(f.Total, f.Moneda)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* ---------- Contexto adicional ---------- */}
        <div className="grid items-start gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader
              title="Timbres"
              description={`Saldo de la cuenta y consumo en ${filtros.anio}.`}
              action={
                timbres ? (
                  <Pill
                    tone={
                      timbres.disponibles <= 0
                        ? "danger"
                        : timbres.disponibles <= TIMBRES_BAJOS
                          ? "warn"
                          : "ok"
                    }
                  >
                    {timbres.disponibles} disponibles
                  </Pill>
                ) : undefined
              }
            />
            <CardBody className="space-y-2">
              {timbres && (
                <>
                  <p
                    className={cx(
                      "text-3xl font-bold leading-none tracking-tight",
                      timbres.disponibles <= 0
                        ? "text-danger"
                        : timbres.disponibles <= TIMBRES_BAJOS
                          ? "text-warn"
                          : "text-ink"
                    )}
                  >
                    {timbres.disponibles}
                  </p>
                  <p className="pb-2 text-[11.5px] text-ink-3">
                    timbres disponibles para toda la cuenta
                  </p>
                  {timbres.disponibles <= TIMBRES_BAJOS && (
                    <Note tone={timbres.disponibles <= 0 ? "danger" : "warn"}>
                      {timbres.disponibles <= 0
                        ? "Sin timbres no puedes emitir ni cancelar. Contacta a tu distribuidor."
                        : "Te quedan pocos timbres: conviene recargar antes de que se acaben."}
                    </Note>
                  )}
                </>
              )}
              <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line-2 py-2">
                <span className="text-[13px] text-ink-3">Usados en timbrado</span>
                <span className="font-mono tabular-nums text-[13px] font-semibold text-ink">
                  {timbresUsados}
                </span>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <span className="text-[13px] text-ink-3">Usados en cancelación</span>
                <span className="font-mono tabular-nums text-[13px] font-semibold text-ink">
                  {timbresCancelados}
                </span>
              </div>
              {ppd && ppd.facturas > 0 && (
                <Note tone="info">
                  {ppd.facturas} comprobante(s) del mes son PPD: cada uno necesita su
                  complemento de pago cuando el cliente abone.
                </Note>
              )}
            </CardBody>
          </Card>

          {data.emisores.length > 1 && (
            <Card>
              <CardHeader
                title="Emisores con actividad"
                description={`Reparto de ${etiquetaCorte}.`}
              />
              <CardBody className="space-y-2.5">
                {data.emisores
                  .slice()
                  .sort((a, b) => b.TotalFacturas - a.TotalFacturas)
                  .map((e) => {
                    const mayor = Math.max(
                      ...data.emisores.map((x) => x.TotalFacturas),
                      1
                    );
                    return (
                      <button
                        key={e.Rfc}
                        type="button"
                        onClick={() => aplicar({ rfc: e.Rfc === filtros.rfc ? "" : e.Rfc })}
                        className={cx(
                          "focus-brand block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2",
                          filtros.rfc === e.Rfc && "bg-brand-050"
                        )}
                      >
                        <span className="flex items-baseline justify-between gap-3">
                          <span className="truncate text-[12.5px] font-medium text-ink">
                            {e.Nombre}
                          </span>
                          <span className="shrink-0 font-mono tabular-nums text-[12.5px] text-ink-2">
                            {money(e.TotalFacturas)}
                          </span>
                        </span>
                        <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-line-2">
                          <span
                            className="block h-full rounded-full bg-[var(--series-1)]"
                            style={{ width: `${(e.TotalFacturas / mayor) * 100}%` }}
                          />
                        </span>
                        <span className="mt-1 block text-[11.5px] text-ink-3">
                          {e.NumFacturas} facturas · {e.Rfc}
                        </span>
                      </button>
                    );
                  })}
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Filtro({
  etiqueta,
  ancho,
  children,
}: {
  etiqueta: string;
  ancho: string;
  children: React.ReactNode;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", ancho)}>
      <span className="text-xs font-semibold text-ink-2">{etiqueta}</span>
      {children}
    </label>
  );
}

function Tile({
  etiqueta,
  valor,
  nota,
  tono,
  destacado,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  tono?: "ok" | "warn";
  destacado?: boolean;
}) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3.5 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {etiqueta}
      </p>
      {/* Cifra grande con figuras proporcionales, no tabulares. */}
      <p
        className={cx(
          "mt-1.5 font-bold leading-none tracking-tight text-ink",
          destacado ? "text-[28px]" : "text-2xl"
        )}
      >
        {valor}
      </p>
      <p
        className={cx(
          "mt-1.5 text-[11.5px]",
          tono === "ok" ? "text-ok" : tono === "warn" ? "text-warn" : "text-ink-3"
        )}
      >
        {nota}
      </p>
    </div>
  );
}
