"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CopyButton,
  EmptyState,
  Pill,
  ProgressBar,
  RowActions,
  SearchInput,
  Segmented,
  Select,
  Table,
  Td,
  Th,
  Toolbar,
  buttonClass,
  cx,
  useToast,
} from "@/components/ui";
import { base64AXml, fechaHora, money } from "@/lib/cfdi";
import {
  resumirValidacion,
  validarEstatusSat,
  type Avance,
} from "@/lib/estatusSat";
import { tipoSerie } from "@/lib/emisorNav";
import { TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import type { Factura, FacturasFiltros } from "@/lib/facturasShared";
import type { Emisor } from "@/lib/emisores";
import { FacturaDetalle } from "./FacturaDetalle";
import { CancelarFacturaModal } from "./CancelarFacturaModal";

type Orden = "fecha-desc" | "fecha-asc" | "total-desc" | "total-asc";

/** Presets del selector de rango. El backend no pagina: el rango es el límite. */
function rango(preset: "mes" | "mesPasado" | "90dias" | "anio") {
  const hoy = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  switch (preset) {
    case "mes":
      return {
        desde: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
        hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
      };
    case "mesPasado":
      return {
        desde: iso(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)),
        hasta: iso(new Date(hoy.getFullYear(), hoy.getMonth(), 0)),
      };
    case "90dias":
      return {
        desde: iso(new Date(hoy.getTime() - 89 * 86_400_000)),
        hasta: iso(hoy),
      };
    case "anio":
      return {
        desde: iso(new Date(hoy.getFullYear(), 0, 1)),
        hasta: iso(new Date(hoy.getFullYear(), 11, 31)),
      };
  }
}

export function FacturasSection({
  facturas,
  emisores,
  filtros,
}: {
  facturas: Factura[];
  emisores: Emisor[];
  filtros: FacturasFiltros;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pendiente, startTransition] = useTransition();

  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<Orden>("fecha-desc");
  const [detalle, setDetalle] = useState<Factura | null>(null);
  const [cancelando, setCancelando] = useState<Factura | null>(null);
  const [bajando, setBajando] = useState<string | null>(null);

  /** UUIDs marcados con la casilla de la tabla. */
  const [seleccion, setSeleccion] = useState<string[]>([]);
  /** Avance de la validación en curso; null = no hay ninguna corriendo. */
  const [validando, setValidando] = useState<Avance | null>(null);
  /**
   * Estatus recién consultados al SAT. Se pintan encima de lo que trae el
   * servidor para que la tabla reaccione mientras la corrida avanza; al
   * terminar, router.refresh() vuelve a traer los datos ya persistidos y este
   * mapa deja de importar.
   */
  const [estatusFresco, setEstatusFresco] = useState<Record<string, string>>({});

  /** Los filtros que pegan al backend viajan en la URL: cambiarlos re-consulta. */
  function aplicar(cambios: Partial<FacturasFiltros>) {
    const nuevos = { ...filtros, ...cambios };
    const params = new URLSearchParams({
      emisor: nuevos.emisor,
      tipo: nuevos.tipo,
      estatus: nuevos.estatus,
      desde: nuevos.desde,
      hasta: nuevos.hasta,
    });
    startTransition(() => router.replace(`/facturas?${params.toString()}`));
  }

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    const lista = query
      ? facturas.filter((f) =>
          `${f.Serie}-${f.Folio} ${f.NombreReceptor} ${f.RfcReceptor} ${f.Uuid} ${f.Nombre}`
            .toLowerCase()
            .includes(query)
        )
      : facturas.slice();

    const num = (f: Factura) => parseFloat(f.Total) || 0;
    const fecha = (f: Factura) => f.FechaEmision || f.FechaReg || "";

    return lista.sort((a, b) => {
      switch (orden) {
        case "fecha-asc":
          return fecha(a).localeCompare(fecha(b));
        case "total-desc":
          return num(b) - num(a);
        case "total-asc":
          return num(a) - num(b);
        default:
          return fecha(b).localeCompare(fecha(a));
      }
    });
  }, [facturas, q, orden]);

  const resumen = useMemo(() => {
    const vigentes = filtradas.filter((f) => f.EstatusSat !== "Cancelado");
    const total = vigentes.reduce((acc, f) => acc + (parseFloat(f.Total) || 0), 0);
    return {
      total,
      vigentes: vigentes.length,
      canceladas: filtradas.length - vigentes.length,
      promedio: vigentes.length ? total / vigentes.length : 0,
    };
  }, [filtradas]);

  async function descargarXml(factura: Factura) {
    setBajando(factura.Uuid);
    try {
      const res = await fetch(`/api/facturas/${encodeURIComponent(factura.Uuid)}/xml`);
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo obtener el XML", "danger");
        return;
      }
      const blob = new Blob([base64AXml(body.base64)], { type: "application/xml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${factura.Uuid}.xml`;
      a.click();
      URL.revokeObjectURL(url);
      toast("XML descargado");
    } finally {
      setBajando(null);
    }
  }

  /**
   * PDF: el backend todavía no lo genera. Se llama igual a la ruta para que el
   * día que exista el endpoint esto funcione sin tocar la UI; hoy responde 501
   * con el motivo.
   */
  async function generarPdf(factura: Factura) {
    const res = await fetch(`/api/facturas/${encodeURIComponent(factura.Uuid)}/pdf`);
    const body = await res.json();
    if (!res.ok) {
      toast(body.error ?? "La generación de PDF aún no está disponible", "danger");
      return;
    }
    const bytes = Uint8Array.from(atob(body.base64), (c) => c.charCodeAt(0));
    const url = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${factura.Uuid}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /** El estatus recién consultado gana sobre el que venía del servidor. */
  function estatusDe(f: Factura) {
    return estatusFresco[f.Uuid] ?? f.EstatusSat;
  }

  const seleccionadas = filtradas.filter((f) => seleccion.includes(f.Uuid));
  const todasMarcadas = filtradas.length > 0 && seleccionadas.length === filtradas.length;

  function alternar(uuid: string) {
    setSeleccion((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  }

  function alternarTodas() {
    setSeleccion(todasMarcadas ? [] : filtradas.map((f) => f.Uuid));
  }

  /**
   * Consulta el estatus real ante el SAT. Sin selección valida todo lo que está
   * en pantalla; con selección, solo lo marcado.
   */
  async function validarEstatus(objetivo: Factura[]) {
    if (objetivo.length === 0 || validando) return;

    setValidando({ hechas: 0, total: objetivo.length });
    try {
      const resultados = await validarEstatusSat(objetivo, (avance) => {
        setValidando(avance);
      });

      setEstatusFresco((prev) => {
        const siguiente = { ...prev };
        for (const r of resultados) {
          if (r.ok && r.estado) siguiente[r.uuid] = r.estado;
        }
        return siguiente;
      });

      const fallidas = resultados.filter((r) => !r.ok);
      toast(
        `SAT: ${resumirValidacion(resultados)}`,
        fallidas.length === resultados.length ? "danger" : "ok"
      );
      setSeleccion([]);
      // apiEstatusV2 ya guardó el estatus en la base: se recarga para quedar
      // en sincronía con lo persistido.
      router.refresh();
    } finally {
      setValidando(null);
    }
  }

  const sinResultados = filtradas.length === 0;

  return (
    <div className="space-y-4">
      {/* ---------- Resumen del rango ---------- */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          etiqueta="Facturado"
          valor={money(resumen.total)}
          nota="sin contar canceladas"
        />
        <Kpi etiqueta="Facturas vigentes" valor={String(resumen.vigentes)} nota="en el rango" />
        <Kpi
          etiqueta="Canceladas"
          valor={String(resumen.canceladas)}
          nota={resumen.canceladas ? "sin efectos fiscales" : "ninguna"}
          tono={resumen.canceladas ? "warn" : undefined}
        />
        <Kpi etiqueta="Promedio" valor={money(resumen.promedio)} nota="por factura vigente" />
      </div>

      <Card>
        {/* ---------- Filtros que van al backend ---------- */}
        <Toolbar className="gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="f-desde">
              Del
            </label>
            <input
              id="f-desde"
              type="date"
              value={filtros.desde}
              onChange={(e) => aplicar({ desde: e.target.value })}
              className="focus-brand rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
            />
            <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="f-hasta">
              al
            </label>
            <input
              id="f-hasta"
              type="date"
              value={filtros.hasta}
              onChange={(e) => aplicar({ hasta: e.target.value })}
              className="focus-brand rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Preset label="Este mes" onClick={() => aplicar(rango("mes"))} />
            <Preset label="Mes pasado" onClick={() => aplicar(rango("mesPasado"))} />
            <Preset label="90 días" onClick={() => aplicar(rango("90dias"))} />
            <Preset label="Este año" onClick={() => aplicar(rango("anio"))} />
          </div>

          <div className="ml-auto w-[210px]">
            <Select
              aria-label="Emisor"
              value={filtros.emisor}
              onChange={(e) => aplicar({ emisor: e.target.value })}
            >
              <option value="">Todos los emisores</option>
              {emisores.map((e) => (
                <option key={e.Rfc} value={e.Rfc}>
                  {e.Nombre}
                </option>
              ))}
            </Select>
          </div>

          <div className="w-[160px]">
            <Select
              aria-label="Tipo de comprobante"
              value={filtros.tipo}
              onChange={(e) => aplicar({ tipo: e.target.value })}
            >
              <option value="TODO">Todos los tipos</option>
              {TIPO_ORDEN.map((t) => (
                <option key={t} value={t}>
                  {TIPO_LABELS[t]}
                </option>
              ))}
            </Select>
          </div>

          <Segmented
            ariaLabel="Estatus ante el SAT"
            value={filtros.estatus}
            onChange={(v) => aplicar({ estatus: v })}
            options={[
              { value: "TODO", label: "Todas" },
              { value: "Vigente", label: "Vigentes" },
              { value: "Cancelado", label: "Canceladas" },
            ]}
          />
        </Toolbar>

        {/* ---------- Búsqueda local sobre lo ya cargado ---------- */}
        <Toolbar>
          <SearchInput
            placeholder="Buscar por folio, receptor, RFC o UUID…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <div className="w-[200px]">
            <Select
              aria-label="Ordenar"
              value={orden}
              onChange={(e) => setOrden(e.target.value as Orden)}
            >
              <option value="fecha-desc">Más recientes primero</option>
              <option value="fecha-asc">Más antiguas primero</option>
              <option value="total-desc">Mayor importe</option>
              <option value="total-asc">Menor importe</option>
            </Select>
          </div>

          <Button
            variant={seleccionadas.length > 0 ? "primary" : "secondary"}
            disabled={Boolean(validando) || filtradas.length === 0}
            onClick={() =>
              validarEstatus(seleccionadas.length > 0 ? seleccionadas : filtradas)
            }
            title="Consulta al SAT el estatus real de cada CFDI y actualiza el guardado"
          >
            {validando
              ? `Validando ${validando.hechas}/${validando.total}…`
              : seleccionadas.length > 0
                ? `Validar ${seleccionadas.length} en el SAT`
                : `Validar las ${filtradas.length} en el SAT`}
          </Button>
        </Toolbar>

        {validando && (
          <div className="border-b border-line-2 px-5 py-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[12px]">
              <span className="font-medium text-ink-2">
                Consultando el SAT factura por factura…
              </span>
              <span className="font-mono text-ink-3">
                {validando.hechas} de {validando.total}
              </span>
            </div>
            <ProgressBar value={(validando.hechas / validando.total) * 100} />
          </div>
        )}

        <div className={cx("transition", pendiente && "pointer-events-none opacity-50")}>
          {sinResultados ? (
            <EmptyState
              title={
                facturas.length === 0
                  ? "No hay facturas en este rango"
                  : "Ninguna factura coincide"
              }
              description={
                facturas.length === 0
                  ? "Cambia las fechas o el emisor, o emite tu primera factura del periodo."
                  : "Prueba con otro folio, receptor o UUID."
              }
              action={
                facturas.length === 0 ? (
                  <Link href="/facturas/nueva" className={buttonClass("primary")}>
                    Nueva factura
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <Table>
              <thead>
                <tr>
                  <Th className="w-10">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las facturas visibles"
                      checked={todasMarcadas}
                      onChange={alternarTodas}
                      className="focus-brand h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]"
                    />
                  </Th>
                  <Th>Folio</Th>
                  <Th>Receptor</Th>
                  <Th>Tipo</Th>
                  <Th>Emisión</Th>
                  <Th className="text-right">Total</Th>
                  <Th>Estatus</Th>
                  <Th className="w-48" />
                </tr>
              </thead>
              <tbody>
                {filtradas.map((f) => {
                  const tipo = tipoSerie(f.TipoComprobante);
                  const estatus = estatusDe(f);
                  const cancelada = estatus === "Cancelado";
                  const marcada = seleccion.includes(f.Uuid);
                  return (
                    <tr
                      key={f.Uuid}
                      onClick={() => setDetalle(f)}
                      className={cx(
                        "group cursor-pointer transition",
                        marcada ? "bg-brand-050" : "hover:bg-surface-2"
                      )}
                    >
                      <Td onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${f.Serie}-${f.Folio}`}
                          checked={marcada}
                          onChange={() => alternar(f.Uuid)}
                          className="focus-brand h-3.5 w-3.5 cursor-pointer accent-[var(--brand)]"
                        />
                      </Td>
                      <Td>
                        <span className="block font-mono text-[13.3px] font-semibold text-ink">
                          {f.Serie ? `${f.Serie}-${f.Folio}` : f.Folio}
                        </span>
                        <span className="mt-0.5 block font-mono text-[10.5px] text-ink-4">
                          {f.Uuid.slice(0, 8)}…{f.Uuid.slice(-4)}
                        </span>
                      </Td>
                      <Td>
                        <span className="block max-w-[26ch] truncate font-medium text-ink">
                          {f.NombreReceptor}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11.3px] text-ink-3">
                          {f.RfcReceptor}
                        </span>
                      </Td>
                      <Td>
                        <Pill tone={tipo.tone}>{tipo.label}</Pill>
                      </Td>
                      <Td className="whitespace-nowrap text-[12.5px]">
                        {fechaHora(f.FechaEmision || f.FechaReg)}
                      </Td>
                      <Td
                        className={cx(
                          "whitespace-nowrap text-right font-mono font-semibold",
                          cancelada ? "text-ink-4 line-through" : "text-ink"
                        )}
                      >
                        {money(f.Total, f.Moneda)}
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            cancelada
                              ? "danger"
                              : estatus === "Vigente"
                                ? "ok"
                                : "warn"
                          }
                          title={
                            estatusFresco[f.Uuid]
                              ? "Recién consultado al SAT"
                              : "Último estatus guardado"
                          }
                        >
                          ● {estatus || "—"}
                        </Pill>
                      </Td>
                      <Td onClick={(e) => e.stopPropagation()}>
                        <RowActions>
                          <CopyButton value={f.Uuid} label="UUID" />
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={bajando === f.Uuid}
                            onClick={() => descargarXml(f)}
                          >
                            {bajando === f.Uuid ? "…" : "XML"}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => generarPdf(f)}>
                            PDF
                          </Button>
                          {!cancelada && (
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => setCancelando(f)}
                            >
                              Cancelar CFDI
                            </Button>
                          )}
                        </RowActions>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          )}
        </div>

        <CardBody className="flex flex-wrap items-center justify-between gap-2 border-t border-line-2 py-3 text-[12px] text-ink-3">
          <span>
            Mostrando {filtradas.length} de {facturas.length} facturas del rango.
          </span>
          {seleccionadas.length > 0 && (
            <button
              type="button"
              onClick={() => setSeleccion([])}
              className="focus-brand rounded font-medium text-brand hover:underline"
            >
              Quitar selección ({seleccionadas.length})
            </button>
          )}
        </CardBody>
      </Card>

      {detalle && (
        <FacturaDetalle
          factura={detalle}
          onClose={() => setDetalle(null)}
          onPdf={() => generarPdf(detalle)}
          onEstatusActualizado={(uuid, estado) => {
            setEstatusFresco((prev) => ({ ...prev, [uuid]: estado }));
            router.refresh();
          }}
          onCancelar={() => {
            setCancelando(detalle);
            setDetalle(null);
          }}
        />
      )}

      {cancelando && (
        <CancelarFacturaModal
          factura={cancelando}
          onClose={() => setCancelando(null)}
          onCancelada={() => {
            setCancelando(null);
            toast("Solicitud de cancelación enviada al SAT");
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function Preset({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-brand rounded-lg border border-line bg-surface-2 px-2.5 py-1 text-[12px] font-medium text-ink-2 transition hover:border-brand hover:text-brand"
    >
      {label}
    </button>
  );
}

function Kpi({
  etiqueta,
  valor,
  nota,
  tono,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  tono?: "warn";
}) {
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
        {etiqueta}
      </p>
      <p
        className={cx(
          "mt-1.5 text-2xl font-bold leading-none tracking-tight",
          tono === "warn" ? "text-warn" : "text-ink"
        )}
      >
        {valor}
      </p>
      <p className="mt-1.5 text-[11.5px] text-ink-3">{nota}</p>
    </div>
  );
}
