"use client";

import { useEffect, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CopyButton,
  Drawer,
  Note,
  Pill,
  Table,
  Td,
  Th,
  cx,
} from "@/components/ui";
import { base64AXml, fechaHora, money, parseCfdi, type Cfdi } from "@/lib/cfdi";
import { tipoSerie } from "@/lib/emisorNav";
import {
  FORMAS_PAGO,
  METODOS_PAGO,
  REGIMENES_FISCALES,
  USOS_CFDI,
} from "@/lib/catalogosSat";
import type { Factura } from "@/lib/facturasShared";
import { validarEstatusSat, type ResultadoEstatus } from "@/lib/estatusSat";
import { GenerarPdfMenu } from "./GenerarPdfMenu";

function etiqueta(
  catalogo: ReadonlyArray<{ value: string; label: string }>,
  value: string
) {
  return catalogo.find((c) => c.value === value)?.label ?? value ?? "—";
}

/**
 * Panel de detalle de una factura, construido a partir del XML timbrado.
 *
 * El XML es la única fuente de verdad de lo que realmente se envió al SAT: la
 * fila del listado es un resumen desnormalizado en la base. Por eso aquí se
 * pide el CFDI y se pinta lo que dice él.
 */
export function FacturaDetalle({
  factura,
  onClose,
  onCancelar,
  onEstatusActualizado,
}: {
  factura: Factura;
  onClose: () => void;
  onCancelar: () => void;
  /** Avisa al listado para que refresque la fila sin recargar todo. */
  onEstatusActualizado?: (uuid: string, estado: string) => void;
}) {
  const [cfdi, setCfdi] = useState<Cfdi | null>(null);
  const [base64, setBase64] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** Resultado de consultar el SAT para esta factura en particular. */
  const [estatusSat, setEstatusSat] = useState<ResultadoEstatus | null>(null);
  const [validando, setValidando] = useState(false);

  useEffect(() => {
    let vivo = true;

    fetch(`/api/facturas/${encodeURIComponent(factura.Uuid)}/xml`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No se pudo obtener el XML");
        return body as { base64: string };
      })
      .then((body) => {
        if (!vivo) return;
        setBase64(body.base64);
        setCfdi(parseCfdi(base64AXml(body.base64)));
      })
      .catch((e: unknown) => {
        if (vivo) setError(e instanceof Error ? e.message : "Error al leer el CFDI");
      });

    return () => {
      vivo = false;
    };
  }, [factura.Uuid]);

  // Si ya se consultó el SAT en este panel, ese estatus manda sobre el guardado.
  const estatus = estatusSat?.ok ? (estatusSat.estado ?? factura.EstatusSat) : factura.EstatusSat;
  const cancelada = estatus === "Cancelado";
  const tipo = tipoSerie(factura.TipoComprobante);

  async function validar() {
    setValidando(true);
    try {
      const [resultado] = await validarEstatusSat([factura], () => {});
      setEstatusSat(resultado);
      if (resultado?.ok) {
        onEstatusActualizado?.(factura.Uuid, resultado.estado ?? "");
      }
    } finally {
      setValidando(false);
    }
  }

  function descargarXml() {
    if (!base64) return;
    const blob = new Blob([base64AXml(base64)], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${factura.Uuid}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <Drawer
      title={
        <span className="flex items-center gap-2">
          {factura.Serie ? `${factura.Serie}-${factura.Folio}` : `Folio ${factura.Folio}`}
          <Pill tone={tipo.tone}>{tipo.label}</Pill>
          <Pill
            tone={cancelada ? "danger" : estatus === "Vigente" ? "ok" : "warn"}
          >
            ● {estatus || "Sin estatus"}
          </Pill>
        </span>
      }
      subtitle={
        <span className="flex flex-wrap items-center gap-2">
          <CopyButton value={factura.Uuid} />
          <span>Timbrada {fechaHora(factura.FechaTimbrado)}</span>
        </span>
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button variant="secondary" onClick={validar} disabled={validando}>
            {validando ? "Consultando SAT…" : "Validar en el SAT"}
          </Button>
          <GenerarPdfMenu
            rfc={factura.Rfc}
            uuid={factura.Uuid}
            size="md"
            variant="secondary"
            label="Generar PDF"
            placement="top"
          />
          <Button variant="secondary" onClick={descargarXml} disabled={!base64}>
            Descargar XML
          </Button>
          {!cancelada && (
            <Button variant="primary" onClick={onCancelar}>
              Cancelar factura
            </Button>
          )}
        </>
      }
    >
      {error && (
        <Note tone="danger" title="No se pudo cargar el XML">
          {error} Los datos de abajo vienen del resumen guardado en la base.
        </Note>
      )}

      {estatusSat && (
        <div className={error ? "mt-3" : undefined}>
          {estatusSat.ok ? (
            <Note
              tone={
                estatusSat.estado === "Vigente"
                  ? "ok"
                  : estatusSat.estado === "Cancelado"
                    ? "danger"
                    : "warn"
              }
              title={`El SAT responde: ${estatusSat.estado || "sin estado"}`}
            >
              <span className="mt-1 block">
                {estatusSat.esCancelable && (
                  <span className="block">Cancelable: {estatusSat.esCancelable}</span>
                )}
                {estatusSat.estatusCancelacion &&
                  estatusSat.estatusCancelacion !== "NO VALIDO" && (
                    <span className="block">
                      Estatus de cancelación: {estatusSat.estatusCancelacion}
                    </span>
                  )}
                {estatusSat.codigoEstatus && (
                  <span className="block text-[11.5px] opacity-80">
                    {estatusSat.codigoEstatus}
                  </span>
                )}
              </span>
            </Note>
          ) : (
            <Note tone="danger" title="No se pudo consultar el SAT">
              {estatusSat.error}
            </Note>
          )}
        </div>
      )}

      {cancelada && (
        <div className={estatusSat || error ? "mt-3" : undefined}>
          <Note tone="danger" title="Factura cancelada ante el SAT">
            {factura.FechaCancelacion
              ? `Cancelada el ${fechaHora(factura.FechaCancelacion)}.`
              : "Ya no tiene efectos fiscales."}
          </Note>
        </div>
      )}

      {!cfdi && !error ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-card border border-line bg-surface"
            />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {/* ---------- Totales ---------- */}
          <Card>
            <CardBody className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  Total
                </p>
                <p className="mt-1 text-3xl font-bold tracking-tight text-ink">
                  {money(cfdi?.total ?? factura.Total, cfdi?.moneda ?? factura.Moneda)}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-3">
                <Mini label="Subtotal" valor={money(cfdi?.subTotal ?? "", cfdi?.moneda)} />
                {cfdi?.descuento && parseFloat(cfdi.descuento) > 0 && (
                  <Mini label="Descuento" valor={money(cfdi.descuento, cfdi.moneda)} />
                )}
                {cfdi?.totalTrasladados && (
                  <Mini
                    label="Impuestos trasladados"
                    valor={money(cfdi.totalTrasladados, cfdi.moneda)}
                  />
                )}
                {cfdi?.totalRetenidos && parseFloat(cfdi.totalRetenidos) > 0 && (
                  <Mini
                    label="Impuestos retenidos"
                    valor={money(cfdi.totalRetenidos, cfdi.moneda)}
                  />
                )}
              </dl>
            </CardBody>
          </Card>

          {/* ---------- Emisor / Receptor ---------- */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader title="Emisor" />
              <CardBody className="py-1">
                <Dato label="Razón social" valor={cfdi?.emisor.nombre ?? factura.Nombre} />
                <Dato label="RFC" valor={cfdi?.emisor.rfc ?? factura.Rfc} mono />
                <Dato
                  label="Régimen fiscal"
                  valor={etiqueta(REGIMENES_FISCALES, cfdi?.emisor.regimenFiscal ?? "")}
                />
                <Dato label="Lugar de expedición" valor={cfdi?.lugarExpedicion ?? ""} mono />
              </CardBody>
            </Card>

            <Card>
              <CardHeader title="Receptor" />
              <CardBody className="py-1">
                <Dato
                  label="Razón social"
                  valor={cfdi?.receptor.nombre ?? factura.NombreReceptor}
                />
                <Dato label="RFC" valor={cfdi?.receptor.rfc ?? factura.RfcReceptor} mono />
                <Dato
                  label="Régimen fiscal"
                  valor={etiqueta(
                    REGIMENES_FISCALES,
                    cfdi?.receptor.regimenFiscal ?? factura.RegimenReceptor
                  )}
                />
                <Dato
                  label="Domicilio fiscal"
                  valor={cfdi?.receptor.domicilioFiscal ?? factura.DomicilioReceptor}
                  mono
                />
                <Dato label="Uso del CFDI" valor={etiqueta(USOS_CFDI, cfdi?.receptor.usoCfdi ?? "")} />
              </CardBody>
            </Card>
          </div>

          {/* ---------- Conceptos ---------- */}
          {cfdi && cfdi.conceptos.length > 0 && (
            <Card>
              <CardHeader
                title="Conceptos"
                description={`${cfdi.conceptos.length} ${
                  cfdi.conceptos.length === 1 ? "concepto" : "conceptos"
                } en este comprobante.`}
              />
              <Table>
                <thead>
                  <tr>
                    <Th>Descripción</Th>
                    <Th className="text-right">Cant.</Th>
                    <Th className="text-right">P. unitario</Th>
                    <Th className="text-right">Importe</Th>
                  </tr>
                </thead>
                <tbody>
                  {cfdi.conceptos.map((c, i) => (
                    <tr key={i}>
                      <Td>
                        <span className="block font-medium text-ink">{c.descripcion}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-ink-3">
                          {c.claveProdServ}
                          {c.noIdentificacion && ` · ${c.noIdentificacion}`}
                          {c.claveUnidad && ` · ${c.unidad || c.claveUnidad}`}
                        </span>
                        {c.traslados.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-1">
                            {c.traslados.map((t, j) => (
                              <Pill key={j} tone="info">
                                {t.impuesto === "002" ? "IVA" : t.impuesto}{" "}
                                {t.tipoFactor === "Exento"
                                  ? "exento"
                                  : `${(parseFloat(t.tasaOCuota) * 100).toFixed(2)}%`}
                              </Pill>
                            ))}
                          </span>
                        )}
                      </Td>
                      <Td className="text-right font-mono">{c.cantidad}</Td>
                      <Td className="text-right font-mono">
                        {money(c.valorUnitario, cfdi.moneda)}
                      </Td>
                      <Td className="text-right font-mono font-semibold text-ink">
                        {money(c.importe, cfdi.moneda)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </Card>
          )}

          {/* ---------- Datos del comprobante ---------- */}
          <Card>
            <CardHeader title="Datos del comprobante" />
            <CardBody className="grid gap-x-8 py-1 sm:grid-cols-2">
              <div>
                <Dato label="Versión CFDI" valor={cfdi?.version ?? factura.Version} />
                <Dato label="Fecha de emisión" valor={fechaHora(cfdi?.fecha ?? factura.FechaEmision)} />
                <Dato
                  label="Forma de pago"
                  valor={etiqueta(FORMAS_PAGO, cfdi?.formaPago ?? factura.FormaPago)}
                />
                <Dato
                  label="Método de pago"
                  valor={etiqueta(METODOS_PAGO, cfdi?.metodoPago ?? factura.MetodoPago)}
                />
              </div>
              <div>
                <Dato label="Moneda" valor={cfdi?.moneda ?? factura.Moneda} />
                {cfdi?.condicionesDePago && (
                  <Dato label="Condiciones de pago" valor={cfdi.condicionesDePago} />
                )}
                <Dato label="Emitida por" valor={factura.NombreUsuario} />
                <Dato label="Registrada" valor={fechaHora(factura.FechaReg)} />
              </div>
            </CardBody>
          </Card>

          {/* ---------- Timbre fiscal ---------- */}
          {cfdi?.timbre && (
            <Card>
              <CardHeader
                title="Timbre fiscal digital"
                description="Lo que certifica que el SAT recibió este comprobante."
              />
              <CardBody className="space-y-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <CampoCopiable label="Folio fiscal (UUID)" valor={cfdi.timbre.uuid} />
                  <CampoCopiable
                    label="No. de certificado del SAT"
                    valor={cfdi.timbre.noCertificadoSAT}
                  />
                  <CampoCopiable
                    label="No. de certificado del emisor"
                    valor={cfdi.noCertificado}
                  />
                  <CampoCopiable label="RFC del PAC" valor={cfdi.timbre.rfcProvCertif} />
                </div>
                <SelloLargo label="Sello digital del CFDI" valor={cfdi.timbre.selloCFD} />
                <SelloLargo label="Sello del SAT" valor={cfdi.timbre.selloSAT} />
              </CardBody>
            </Card>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-mono font-semibold text-ink">{valor}</dd>
    </div>
  );
}

function Dato({
  label,
  valor,
  mono,
}: {
  label: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line-2 py-2 last:border-0">
      <span className="shrink-0 text-[12.5px] text-ink-3">{label}</span>
      <span
        className={cx(
          "text-right text-[12.8px] font-semibold text-ink",
          mono && "font-mono"
        )}
      >
        {valor || "—"}
      </span>
    </div>
  );
}

function CampoCopiable({ label, valor }: { label: string; valor: string }) {
  if (!valor) return null;
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[11.5px] font-semibold text-ink-2">{label}</p>
      <CopyButton value={valor} className="w-full justify-between" />
    </div>
  );
}

/** Los sellos son cadenas de ~340 caracteres: se muestran recortados. */
function SelloLargo({ label, valor }: { label: string; valor: string }) {
  const [abierto, setAbierto] = useState(false);
  if (!valor) return null;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2">
        <p className="text-[11.5px] font-semibold text-ink-2">{label}</p>
        <button
          type="button"
          onClick={() => setAbierto((v) => !v)}
          className="focus-brand rounded text-[11.5px] font-medium text-brand hover:underline"
        >
          {abierto ? "Ocultar" : "Ver completo"}
        </button>
      </div>
      <p
        className={cx(
          "break-all rounded-lg border border-line bg-surface-2 p-2.5 font-mono text-[10.5px] leading-relaxed text-ink-3",
          !abierto && "line-clamp-2"
        )}
      >
        {valor}
      </p>
    </div>
  );
}
