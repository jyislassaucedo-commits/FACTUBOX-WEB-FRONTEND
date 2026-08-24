"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Field,
  FieldError,
  Note,
  Pill,
  Select,
  Table,
  Td,
  Th,
  buttonClass,
  cx,
} from "@/components/ui";
import {
  FORMAS_PAGO,
  METODOS_PAGO,
  MONEDAS,
  REGIMENES_FISCALES,
  USOS_CFDI,
} from "@/lib/catalogosSat";
import { fechaHora, money } from "@/lib/cfdi";
import { ConceptoEditor } from "./ConceptoEditor";
import { ElegirFacturaOrigenModal } from "./ElegirFacturaOrigenModal";
import {
  CONCEPTO_VACIO,
  RFC_PUBLICO_GENERAL,
  TIPOS_COMPROBANTE,
  TIPOS_RELACION,
  calcularTotales,
  etiquetaTipo,
  type FacturaBorrador,
  type PagoBorrador,
  type Problema,
} from "@/lib/facturaNueva";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
import type { TipoComprobante } from "@/lib/timbrado";

type Comun = {
  borrador: FacturaBorrador;
  set: (cambios: Partial<FacturaBorrador>) => void;
  problemas: Problema[];
  mostrarErrores: boolean;
};

/** Primer mensaje de un campo, o undefined si el paso aún no debe señalar nada. */
function mensajeDe(problemas: Problema[], campo: string, mostrar: boolean) {
  if (!mostrar) return undefined;
  return problemas.find((p) => p.campo === campo)?.mensaje;
}

/* ========================================================================== */
/* 1. Tipo de comprobante                                                     */
/* ========================================================================== */

export function PasoTipo({ borrador, set }: Comun) {
  return (
    <Card>
      <CardHeader
        title="¿Qué comprobante vas a emitir?"
        description="De esto depende qué datos te voy a pedir más adelante."
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          {TIPOS_COMPROBANTE.map((tipo) => {
            const activo = borrador.tipo === tipo.value;
            return (
              <button
                key={tipo.value}
                type="button"
                disabled={!tipo.disponible}
                onClick={() =>
                  set({
                    tipo: tipo.value as TipoComprobante,
                    // La serie depende del tipo: al cambiarlo hay que
                    // recalcularla, no arrastrar la anterior.
                    serie: "",
                    folio: "",
                    // Un ingreso no lleva CFDI relacionados en este flujo.
                    relacion:
                      tipo.value === "E"
                        ? borrador.relacion
                        : { tipoRelacion: "01", uuids: [] },
                    // El uso más común de una nota de crédito.
                    usoCfdi: tipo.value === "E" ? "G02" : borrador.usoCfdi,
                  })
                }
                className={cx(
                  "focus-brand rounded-xl border p-4 text-left transition",
                  !tipo.disponible
                    ? "cursor-not-allowed border-line bg-surface-2 opacity-60"
                    : activo
                      ? "border-brand bg-brand-050 shadow-card"
                      : "border-line bg-surface hover:-translate-y-0.5 hover:border-ink-4 hover:shadow-raised"
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <span
                    className={cx(
                      "text-[15px] font-bold tracking-tight",
                      activo ? "text-brand-600" : "text-ink"
                    )}
                  >
                    {tipo.label}
                  </span>
                  {tipo.disponible ? (
                    activo && <Pill tone="brand">Seleccionado</Pill>
                  ) : (
                    <Pill>Próximamente</Pill>
                  )}
                </span>
                <span className="mt-0.5 block text-[12.5px] font-medium text-ink-2">
                  {tipo.resumen}
                </span>
                <span className="mt-2 block text-[12.5px] leading-relaxed text-ink-3">
                  {tipo.detalle}
                </span>
                {!tipo.disponible && tipo.motivo && (
                  <span className="mt-2 block text-[11.5px] text-ink-4">{tipo.motivo}</span>
                )}
              </button>
            );
          })}
        </div>

        {borrador.tipo === "E" && (
          <div className="mt-4">
            <Note tone="info" title="Vas a emitir una nota de crédito">
              En el siguiente paso te voy a pedir qué factura corrige. Sin esa
              relación, el receptor no puede amarrar la nota con su factura
              original.
            </Note>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/* ========================================================================== */
/* 2. Emisor, serie y pago                                                    */
/* ========================================================================== */

export function PasoEmisor({
  borrador,
  set,
  problemas,
  mostrarErrores,
  emisores,
  series,
  cargandoSeries,
  onAbrirRelacion,
}: Comun & {
  emisores: Emisor[];
  series: Serie[];
  cargandoSeries: boolean;
  onAbrirRelacion: () => void;
}) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const emisor = emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;
  const sinCsd = emisor && (!emisor.Cert || !emisor.Key);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Quién factura"
          description="El emisor define el RFC, el régimen y el lugar de expedición del CFDI."
        />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Emisor" className="sm:col-span-2">
            <Select
              value={borrador.rfcEmisor}
              onChange={(e) => set({ rfcEmisor: e.target.value, serie: "", folio: "" })}
              aria-invalid={Boolean(err("rfcEmisor"))}
            >
              <option value="">Selecciona un emisor</option>
              {emisores.map((e) => (
                <option key={e.Rfc} value={e.Rfc}>
                  {e.Nombre} ({e.Rfc})
                </option>
              ))}
            </Select>
            <FieldError mensaje={err("rfcEmisor")} />
          </Field>

          {sinCsd && (
            <div className="sm:col-span-2">
              <Note tone="danger" title="Este emisor no tiene CSD">
                Sin certificado de sello digital no se puede timbrar.{" "}
                <Link
                  href={`/emisores/${encodeURIComponent(borrador.rfcEmisor)}/csd`}
                  className="font-semibold underline"
                >
                  Subir el certificado
                </Link>
              </Note>
            </div>
          )}

          <Field
            label="Serie"
            hint={`Solo se listan las series de tipo ${etiquetaTipo(borrador.tipo)}.`}
          >
            <Select
              value={borrador.serie}
              disabled={!borrador.rfcEmisor || cargandoSeries}
              onChange={(e) => set({ serie: e.target.value, folio: "" })}
              aria-invalid={Boolean(err("serie"))}
            >
              <option value="">
                {cargandoSeries ? "Cargando series…" : "Selecciona una serie"}
              </option>
              {series.map((s) => (
                <option key={`${s.Tipo}-${s.Nombre}`} value={s.Nombre}>
                  {s.Nombre}
                </option>
              ))}
            </Select>
            <FieldError mensaje={err("serie")} />
            {borrador.rfcEmisor && !cargandoSeries && series.length === 0 && (
              <Link
                href={`/emisores/${encodeURIComponent(borrador.rfcEmisor)}/series`}
                className="text-[11.5px] font-medium text-brand hover:underline"
              >
                Crear una serie de {etiquetaTipo(borrador.tipo).toLowerCase()}
              </Link>
            )}
          </Field>

          <Field label="Folio" hint="Se calcula solo a partir del último timbrado.">
            <div
              className={cx(
                "flex h-[38px] items-center rounded-[10px] border border-line bg-surface-2 px-3 font-mono text-sm",
                borrador.folio ? "text-ink" : "text-ink-4"
              )}
            >
              {borrador.folio || "—"}
            </div>
            <FieldError mensaje={err("folio")} />
          </Field>

          {/* Un CFDI de Pago no lleva forma/método de pago ni condiciones a
              nivel comprobante: la forma real va dentro de cada Pago del
              complemento, capturada en el siguiente paso. */}
          {borrador.tipo !== "P" && (
            <>
              <Field label="Forma de pago">
                <Select
                  value={borrador.formaPago}
                  onChange={(e) => set({ formaPago: e.target.value })}
                  aria-invalid={Boolean(err("formaPago"))}
                >
                  {FORMAS_PAGO.map((f) => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </Select>
                <FieldError mensaje={err("formaPago")} />
              </Field>

              <Field label="Método de pago">
                <Select
                  value={borrador.metodoPago}
                  onChange={(e) => set({ metodoPago: e.target.value })}
                  aria-invalid={Boolean(err("metodoPago"))}
                >
                  {METODOS_PAGO.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
                <FieldError mensaje={err("metodoPago")} />
              </Field>

              <Field label="Condiciones de pago (opcional)" className="sm:col-span-2">
                <input
                  className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand"
                  placeholder="Ej. Contado, 30 días…"
                  value={borrador.condicionesDePago}
                  onChange={(e) => set({ condicionesDePago: e.target.value })}
                />
              </Field>
            </>
          )}
        </CardBody>
      </Card>

      {borrador.tipo === "E" && (
        <Card>
          <CardHeader
            title="Factura que corrige esta nota de crédito"
            description="Puedes buscarla en tus facturas timbradas o pegar el folio fiscal a mano."
            action={
              <Button
                variant={borrador.relacion.uuids.length === 0 ? "primary" : "secondary"}
                onClick={onAbrirRelacion}
                disabled={!borrador.rfcEmisor}
              >
                {borrador.relacion.uuids.length === 0 ? "Relacionar factura" : "Agregar otra"}
              </Button>
            }
          />
          <CardBody className="space-y-3">
            <Field label="Tipo de relación">
              <Select
                value={borrador.relacion.tipoRelacion}
                onChange={(e) =>
                  set({ relacion: { ...borrador.relacion, tipoRelacion: e.target.value } })
                }
              >
                {TIPOS_RELACION.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            {borrador.relacion.uuids.length === 0 ? (
              <Note tone={mostrarErrores && err("relacion") ? "danger" : "warn"}>
                {err("relacion") ??
                  "Todavía no relacionas ninguna factura. Es obligatorio para una nota de crédito."}
              </Note>
            ) : (
              <ul className="space-y-2">
                {borrador.relacion.uuids.map((uuid) => (
                  <li
                    key={uuid}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
                  >
                    <span className="min-w-0 break-all font-mono text-[11.5px] text-ink">
                      {uuid}
                    </span>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() =>
                        set({
                          relacion: {
                            ...borrador.relacion,
                            uuids: borrador.relacion.uuids.filter((u) => u !== uuid),
                          },
                        })
                      }
                    >
                      Quitar
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

/* ========================================================================== */
/* 3. Receptor                                                                */
/* ========================================================================== */

export function PasoReceptor({
  borrador,
  set,
  problemas,
  mostrarErrores,
  receptores,
  receptorActual,
  cargandoReceptores,
  onNuevoReceptor,
}: Comun & {
  receptores: Receptor[];
  receptorActual: Receptor | null;
  cargandoReceptores: boolean;
  onNuevoReceptor: () => void;
}) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const esGenerico = borrador.receptorRfc === RFC_PUBLICO_GENERAL;

  return (
    <Card>
      <CardHeader
        title="¿A quién le facturas?"
        description="Los datos fiscales salen del receptor guardado: deben coincidir con su constancia."
        action={
          <Button variant="secondary" onClick={onNuevoReceptor} disabled={!borrador.rfcEmisor}>
            Nuevo receptor
          </Button>
        }
      />
      <CardBody className="grid gap-4 sm:grid-cols-2">
        <Field label="Cliente">
          <Select
            value={borrador.receptorRfc}
            disabled={cargandoReceptores}
            onChange={(e) => {
              const rfc = e.target.value;
              const r =
                rfc === RFC_PUBLICO_GENERAL
                  ? null
                  : receptores.find((x) => x.Rfc === rfc);
              set({
                receptorRfc: rfc,
                usoCfdi:
                  borrador.tipo === "E"
                    ? "G02"
                    : r?.UsoCfdi || (rfc === RFC_PUBLICO_GENERAL ? "S01" : borrador.usoCfdi),
              });
            }}
            aria-invalid={Boolean(err("receptorRfc"))}
          >
            <option value={RFC_PUBLICO_GENERAL}>Público en general</option>
            {receptores.map((r) => (
              <option key={r.Rfc} value={r.Rfc}>
                {r.Nombre} ({r.Rfc})
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("receptorRfc")} />
        </Field>

        <Field label="Uso del CFDI" hint="Lo declara el receptor en su contabilidad.">
          <Select
            value={borrador.usoCfdi}
            onChange={(e) => set({ usoCfdi: e.target.value })}
            aria-invalid={Boolean(err("usoCfdi"))}
          >
            {USOS_CFDI.map((u) => (
              <option key={u.value} value={u.value}>
                {u.label}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("usoCfdi")} />
        </Field>

        {borrador.tipo === "E" && borrador.usoCfdi !== "G02" && (
          <div className="sm:col-span-2">
            <Note tone="warn">
              Para una nota de crédito lo habitual es el uso{" "}
              <strong>G02 - Devoluciones, descuentos o bonificaciones</strong>.
            </Note>
          </div>
        )}

        {esGenerico ? (
          <div className="sm:col-span-2">
            <Note tone="info" title="Público en general">
              {borrador.tipo === "I"
                ? "El CFDI llevará el nodo InformacionGlobal y el CP del emisor como domicilio del receptor, como pide el SAT."
                : "Una nota de crédito a público en general es inusual; revisa que sea lo que quieres."}
            </Note>
          </div>
        ) : (
          receptorActual && (
            <div className="rounded-xl border border-line bg-surface-2 p-3.5 sm:col-span-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Datos que viajarán en el CFDI
              </p>
              <dl className="mt-2 grid gap-x-6 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
                <Dato etiqueta="Razón social" valor={receptorActual.Nombre} />
                <Dato etiqueta="RFC" valor={receptorActual.Rfc} mono />
                <Dato
                  etiqueta="Régimen fiscal"
                  valor={
                    REGIMENES_FISCALES.find((r) => r.value === receptorActual.RegimenFiscal)
                      ?.label ?? receptorActual.RegimenFiscal
                  }
                />
                <Dato etiqueta="Domicilio fiscal (CP)" valor={receptorActual.DomicilioFiscal} mono />
              </dl>
              {(!receptorActual.RegimenFiscal || !receptorActual.DomicilioFiscal) && (
                <div className="mt-3">
                  <Note tone="danger" title="Faltan datos fiscales del receptor">
                    Edítalo en{" "}
                    <Link
                      href={`/emisores/${encodeURIComponent(borrador.rfcEmisor)}/receptores`}
                      className="font-semibold underline"
                    >
                      Receptores
                    </Link>{" "}
                    antes de timbrar.
                  </Note>
                </div>
              )}
            </div>
          )
        )}
      </CardBody>
    </Card>
  );
}

/* ========================================================================== */
/* 4. Conceptos                                                               */
/* ========================================================================== */

export function PasoConceptos({ borrador, set, problemas, mostrarErrores }: Comun) {
  const totales = calcularTotales(borrador.conceptos);

  /** Errores del paso, agrupados por índice de concepto. */
  const porConcepto = borrador.conceptos.map((_, i) => {
    const prefijo = `concepto.${i}.`;
    return Object.fromEntries(
      problemas
        .filter((p) => p.campo.startsWith(prefijo))
        .map((p) => [p.campo.slice(prefijo.length), p.mensaje])
    );
  });

  const generales = problemas.filter((p) => p.campo === "conceptos");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Conceptos"
          description="Lo que estás cobrando. Los impuestos se calculan por concepto."
          action={
            <Button
              variant="secondary"
              onClick={() => set({ conceptos: [...borrador.conceptos, { ...CONCEPTO_VACIO }] })}
            >
              Agregar concepto
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {borrador.conceptos.map((c, i) => (
            <ConceptoEditor
              key={i}
              concepto={c}
              indice={i}
              errores={porConcepto[i]}
              mostrarErrores={mostrarErrores}
              puedeEliminar={borrador.conceptos.length > 1}
              onChange={(nuevo) =>
                set({ conceptos: borrador.conceptos.map((prev, idx) => (idx === i ? nuevo : prev)) })
              }
              onRemove={() =>
                set({ conceptos: borrador.conceptos.filter((_, idx) => idx !== i) })
              }
            />
          ))}

          {mostrarErrores &&
            generales.map((p) => (
              <Note key={p.mensaje} tone="danger">
                {p.mensaje}
              </Note>
            ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="ml-auto max-w-sm space-y-1.5">
          <Renglon etiqueta="Subtotal" valor={money(totales.subtotal)} />
          {totales.trasladados > 0 && (
            <Renglon etiqueta="Impuestos trasladados" valor={money(totales.trasladados)} />
          )}
          {totales.retenidos > 0 && (
            <Renglon etiqueta="Retenciones" valor={`− ${money(totales.retenidos)}`} />
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
            <span className="text-[13px] font-semibold text-ink">Total</span>
            <span className="font-mono text-xl font-bold tracking-tight text-ink">
              {money(totales.total)}
            </span>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

/* ========================================================================== */
/* 4b. Pagos (reemplaza a Conceptos cuando el tipo es "P")                    */
/* ========================================================================== */

export function PasoPagos({
  borrador,
  set,
  problemas,
  mostrarErrores,
  autoUuid,
}: Comun & {
  /** Folio fiscal a precargar una sola vez (viene de "Pagar factura" en el detalle). */
  autoUuid?: string;
}) {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const autoIntentado = useRef(false);

  const pago = borrador.pago;
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);

  function setPago(cambios: Partial<PagoBorrador>) {
    set({ pago: { ...pago, ...cambios } });
  }

  async function elegirFactura(uuid: string) {
    setCargando(true);
    setErrorCarga(null);
    try {
      const res = await fetch(
        `/api/facturas/${encodeURIComponent(uuid)}/pagos-relacionados?rfcEmisor=${encodeURIComponent(borrador.rfcEmisor)}`
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo consultar la factura");

      const origen = {
        uuid: body.Origen.Uuid as string,
        serie: body.Origen.Serie as string,
        folio: body.Origen.Folio as string,
        total: body.Origen.Total as string,
        moneda: (body.Origen.Moneda as string) || "MXN",
        rfcReceptor: body.Origen.RfcReceptor as string,
        nombreReceptor: body.Origen.NombreReceptor as string,
        regimenFiscalReceptor: body.Origen.RegimenFiscalReceptor as string,
        domicilioFiscalReceptor: String(body.Origen.DomicilioFiscalReceptor ?? ""),
        traslados: body.Origen.Traslados,
        retenciones: body.Origen.Retenciones,
      };
      const detectado = {
        saldoPendiente: body.SaldoPendiente as string,
        siguienteParcialidad: body.SiguienteParcialidad as string,
        pagosPrevios: body.PagosPrevios,
      };

      setPago({
        facturaOrigen: origen,
        monedaP: origen.moneda,
        impSaldoAnt: detectado.saldoPendiente,
        numParcialidad: detectado.siguienteParcialidad,
        monto: "",
        detectado,
        usarDetectado: true,
      });
    } catch (e) {
      setErrorCarga(e instanceof Error ? e.message : "Error al consultar la factura");
    } finally {
      setCargando(false);
    }
  }

  // "Pagar factura" en el detalle manda aquí con el emisor y el UUID ya
  // resueltos: en cuanto haya rfcEmisor, se precarga una sola vez.
  useEffect(() => {
    if (!autoUuid || autoIntentado.current || !borrador.rfcEmisor || pago.facturaOrigen) return;
    autoIntentado.current = true;
    elegirFactura(autoUuid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoUuid, borrador.rfcEmisor]);

  function alternarDetectado() {
    if (!pago.detectado) return;
    setPago(
      pago.usarDetectado
        ? { usarDetectado: false }
        : {
            usarDetectado: true,
            impSaldoAnt: pago.detectado.saldoPendiente,
            numParcialidad: pago.detectado.siguienteParcialidad,
          }
    );
  }

  const monto = parseFloat(pago.monto) || 0;
  const saldoAnt = parseFloat(pago.impSaldoAnt) || 0;
  const saldoInsoluto = Math.max(saldoAnt - monto, 0);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Qué factura se paga"
          description="Solo facturas PPD vigentes se pueden saldar con un complemento de pago."
          action={
            <Button
              variant={pago.facturaOrigen ? "secondary" : "primary"}
              onClick={() => setModalAbierto(true)}
              disabled={!borrador.rfcEmisor || cargando}
            >
              {cargando ? "Consultando…" : pago.facturaOrigen ? "Cambiar factura" : "Elegir factura"}
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {!borrador.rfcEmisor && <Note tone="warn">Elige primero el emisor.</Note>}
          {errorCarga && <Note tone="danger">{errorCarga}</Note>}

          {!pago.facturaOrigen ? (
            <Note tone={mostrarErrores && err("facturaOrigen") ? "danger" : "warn"}>
              {err("facturaOrigen") ?? "Todavía no elegiste qué factura se va a pagar."}
            </Note>
          ) : (
            <div className="rounded-xl border border-line bg-surface-2 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2">
                    <span className="font-mono text-[14px] font-semibold text-ink">
                      {pago.facturaOrigen.serie
                        ? `${pago.facturaOrigen.serie}-${pago.facturaOrigen.folio}`
                        : pago.facturaOrigen.folio}
                    </span>
                    <Pill tone="info">PPD</Pill>
                  </p>
                  <p className="mt-0.5 truncate text-[12.5px] text-ink-3">
                    {pago.facturaOrigen.nombreReceptor}
                  </p>
                  <p className="mt-0.5 break-all font-mono text-[11px] text-ink-4">
                    {pago.facturaOrigen.uuid}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="font-mono text-[14px] font-semibold text-ink">
                    {money(pago.facturaOrigen.total, pago.facturaOrigen.moneda)}
                  </p>
                  <p className="text-[11px] text-ink-3">Total de la factura</p>
                </div>
              </div>
            </div>
          )}

          {pago.facturaOrigen && pago.detectado && pago.detectado.pagosPrevios.length > 0 && (
            <Note
              tone={pago.usarDetectado ? "info" : "warn"}
              title={pago.usarDetectado ? "Se detectó un pago anterior" : "Ignorando el pago detectado"}
            >
              <p>
                {pago.usarDetectado
                  ? `Ya se timbraron ${pago.detectado.pagosPrevios.length} pago(s) de esta factura. Saldo pendiente detectado: ${money(pago.detectado.saldoPendiente, pago.facturaOrigen.moneda)} (siguiente parcialidad ${pago.detectado.siguienteParcialidad}). Se aplicó automáticamente abajo.`
                  : "Estás capturando el saldo pendiente a mano, sin usar lo que el sistema detectó."}
              </p>
              <button
                type="button"
                onClick={alternarDetectado}
                className="focus-brand mt-1.5 rounded text-[12px] font-semibold underline"
              >
                {pago.usarDetectado ? "Quitarlo y capturar el saldo a mano" : "Usar el saldo detectado"}
              </button>
            </Note>
          )}
        </CardBody>
      </Card>

      {pago.facturaOrigen && (
        <Card>
          <CardHeader
            title="Datos del pago"
            description="Lo que se recibió y con qué se salda la factura."
          />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Fecha en que se recibió el pago">
              <input
                type="datetime-local"
                className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand"
                value={pago.fechaPago}
                onChange={(e) => setPago({ fechaPago: e.target.value })}
                aria-invalid={Boolean(err("fechaPago"))}
              />
              <FieldError mensaje={err("fechaPago")} />
            </Field>

            <Field label="Forma en que se pagó">
              <Select
                value={pago.formaDePagoP}
                onChange={(e) => setPago({ formaDePagoP: e.target.value })}
                aria-invalid={Boolean(err("formaDePagoP"))}
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <FieldError mensaje={err("formaDePagoP")} />
            </Field>

            <Field label="Moneda del pago" hint="Por default, la misma de la factura - la puedes cambiar.">
              <Select
                value={pago.monedaP}
                onChange={(e) => setPago({ monedaP: e.target.value })}
                aria-invalid={Boolean(err("monedaP"))}
              >
                {MONEDAS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
              <FieldError mensaje={err("monedaP")} />
            </Field>

            {pago.monedaP !== "MXN" && (
              <Field label="Tipo de cambio">
                <input
                  type="number"
                  min={0}
                  step="0.0001"
                  className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand"
                  value={pago.tipoCambioP}
                  onChange={(e) => setPago({ tipoCambioP: e.target.value })}
                  aria-invalid={Boolean(err("tipoCambioP"))}
                />
                <FieldError mensaje={err("tipoCambioP")} />
              </Field>
            )}

            <Field
              label="Saldo antes de este pago"
              hint={pago.usarDetectado && pago.detectado ? "Detectado automáticamente." : undefined}
            >
              <input
                type="number"
                min={0}
                step="0.01"
                className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand disabled:opacity-60"
                value={pago.impSaldoAnt}
                disabled={pago.usarDetectado && Boolean(pago.detectado)}
                onChange={(e) => setPago({ impSaldoAnt: e.target.value })}
                aria-invalid={Boolean(err("impSaldoAnt"))}
              />
              <FieldError mensaje={err("impSaldoAnt")} />
            </Field>

            <Field label="Cuánto pagó ahora">
              <input
                type="number"
                min={0}
                step="0.01"
                className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 font-mono text-sm text-ink focus:border-brand"
                value={pago.monto}
                onChange={(e) => setPago({ monto: e.target.value })}
                aria-invalid={Boolean(err("monto"))}
              />
              <FieldError mensaje={err("monto")} />
            </Field>
          </CardBody>

          <CardBody className="border-t border-line-2 pt-4">
            <div className="ml-auto max-w-xs space-y-1.5">
              <Renglon etiqueta="Saldo antes de este pago" valor={money(saldoAnt, pago.monedaP)} />
              <Renglon etiqueta="Monto pagado" valor={money(monto, pago.monedaP)} />
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
                <span className="text-[13px] font-semibold text-ink">Saldo insoluto</span>
                <span className="font-mono text-lg font-bold tracking-tight text-ink">
                  {money(saldoInsoluto, pago.monedaP)}
                </span>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {modalAbierto && (
        <ElegirFacturaOrigenModal
          rfcEmisor={borrador.rfcEmisor}
          onClose={() => setModalAbierto(false)}
          onElegir={elegirFactura}
        />
      )}
    </div>
  );
}

/* ========================================================================== */
/* 5. Revisión                                                                */
/* ========================================================================== */

export function PasoRevision({
  borrador,
  emisores,
  receptorActual,
  problemasTotales,
  onIrA,
}: {
  borrador: FacturaBorrador;
  emisores: Emisor[];
  receptorActual: Receptor | null;
  problemasTotales: Array<{ paso: string; titulo: string; problemas: Problema[] }>;
  onIrA: (paso: string) => void;
}) {
  const emisor = emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;
  const totales = calcularTotales(borrador.conceptos);
  const conProblemas = problemasTotales.filter((p) => p.problemas.length > 0);
  const esPago = borrador.tipo === "P";
  const pago = borrador.pago;
  const montoPago = parseFloat(pago.monto) || 0;

  return (
    <div className="space-y-4">
      {conProblemas.length > 0 ? (
        <Card>
          <CardHeader
            title="Falta información"
            description="Corrige esto antes de timbrar; el timbre se consume aunque el CFDI salga mal."
          />
          <CardBody className="space-y-2">
            {conProblemas.map((grupo) => (
              <div
                key={grupo.paso}
                className="flex items-start justify-between gap-3 rounded-xl border border-warn/40 bg-warn-bg px-3.5 py-3"
              >
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-warn">{grupo.titulo}</p>
                  <ul className="mt-1 space-y-0.5">
                    {grupo.problemas.map((p) => (
                      <li key={p.campo + p.mensaje} className="text-[12.5px] text-warn">
                        · {p.mensaje}
                      </li>
                    ))}
                  </ul>
                </div>
                <Button variant="secondary" size="sm" onClick={() => onIrA(grupo.paso)}>
                  Corregir
                </Button>
              </div>
            ))}
          </CardBody>
        </Card>
      ) : (
        <Note tone="ok" title="Todo listo">
          Revisa el comprobante y timbra. Al hacerlo se consume un timbre y el
          CFDI queda registrado ante el SAT.
        </Note>
      )}

      <Card>
        <CardHeader
          title={`${etiquetaTipo(borrador.tipo)} ${borrador.serie}-${borrador.folio}`}
          description="Así quedará el comprobante."
          action={<Pill tone="brand">{money(esPago ? montoPago : totales.total, esPago ? pago.monedaP : undefined)}</Pill>}
        />
        <CardBody className="grid gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Emisor
            </p>
            <Dato etiqueta="Razón social" valor={emisor?.Nombre ?? "—"} />
            <Dato etiqueta="RFC" valor={emisor?.Rfc ?? "—"} mono />
            <Dato etiqueta="Lugar de expedición" valor={emisor?.LugarExp ?? "—"} mono />
          </div>
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              Receptor
            </p>
            <Dato etiqueta="Razón social" valor={receptorActual?.Nombre ?? "—"} />
            <Dato etiqueta="RFC" valor={receptorActual?.Rfc ?? "—"} mono />
            <Dato etiqueta="Uso del CFDI" valor={esPago ? "CP01 - Pagos" : USOS_CFDI.find((u) => u.value === borrador.usoCfdi)?.label ?? borrador.usoCfdi} />
          </div>

          {esPago ? (
            <div className="sm:col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Pago
              </p>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Dato
                  etiqueta="Factura que se paga"
                  valor={
                    pago.facturaOrigen
                      ? pago.facturaOrigen.serie
                        ? `${pago.facturaOrigen.serie}-${pago.facturaOrigen.folio}`
                        : pago.facturaOrigen.folio
                      : "—"
                  }
                  mono
                />
                <Dato etiqueta="Parcialidad" valor={pago.numParcialidad || "—"} />
                <Dato
                  etiqueta="Fecha de pago"
                  valor={pago.fechaPago ? pago.fechaPago.replace("T", " ") : "—"}
                />
                <Dato
                  etiqueta="Forma de pago"
                  valor={FORMAS_PAGO.find((f) => f.value === pago.formaDePagoP)?.label ?? "—"}
                />
                <Dato etiqueta="Saldo antes del pago" valor={money(pago.impSaldoAnt, pago.monedaP)} />
                <Dato etiqueta="Monto pagado" valor={money(pago.monto, pago.monedaP)} />
                <Dato
                  etiqueta="Saldo insoluto"
                  valor={money(
                    Math.max((parseFloat(pago.impSaldoAnt) || 0) - montoPago, 0),
                    pago.monedaP
                  )}
                />
              </div>
            </div>
          ) : (
            <div className="sm:col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                Pago
              </p>
              <div className="grid gap-x-6 sm:grid-cols-2">
                <Dato
                  etiqueta="Forma de pago"
                  valor={FORMAS_PAGO.find((f) => f.value === borrador.formaPago)?.label ?? "—"}
                />
                <Dato
                  etiqueta="Método de pago"
                  valor={METODOS_PAGO.find((m) => m.value === borrador.metodoPago)?.label ?? "—"}
                />
                {borrador.condicionesDePago && (
                  <Dato etiqueta="Condiciones" valor={borrador.condicionesDePago} />
                )}
              </div>
            </div>
          )}

          {borrador.tipo === "E" && (
            <div className="sm:col-span-2">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                CFDI relacionados
              </p>
              {borrador.relacion.uuids.length === 0 ? (
                <p className="text-[12.5px] text-warn">Ninguno relacionado.</p>
              ) : (
                <ul className="space-y-1">
                  {borrador.relacion.uuids.map((u) => (
                    <li key={u} className="break-all font-mono text-[11.5px] text-ink-2">
                      {TIPOS_RELACION.find((t) => t.value === borrador.relacion.tipoRelacion)
                        ?.value ?? borrador.relacion.tipoRelacion}{" "}
                      · {u}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </CardBody>

        {!esPago && (
          <>
            <Table>
              <thead>
                <tr>
                  <Th>Concepto</Th>
                  <Th className="text-right">Cant.</Th>
                  <Th className="text-right">P. unitario</Th>
                  <Th className="text-right">Importe</Th>
                </tr>
              </thead>
              <tbody>
                {borrador.conceptos.map((c, i) => (
                  <tr key={i}>
                    <Td>
                      <span className="block font-medium text-ink">
                        {c.descripcion || <span className="text-warn">sin descripción</span>}
                      </span>
                      <span className="mt-0.5 block font-mono text-[11px] text-ink-3">
                        {c.claveProdServ || "sin clave"} · {c.unidad}
                      </span>
                    </Td>
                    <Td className="text-right font-mono">{c.cantidad}</Td>
                    <Td className="text-right font-mono">{money(c.valorUnitario)}</Td>
                    <Td className="text-right font-mono font-semibold text-ink">
                      {money(c.cantidad * c.valorUnitario)}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>

            <CardBody className="ml-auto max-w-sm space-y-1.5 border-t border-line-2">
              <Renglon etiqueta="Subtotal" valor={money(totales.subtotal)} />
              {totales.trasladados > 0 && (
                <Renglon etiqueta="Impuestos trasladados" valor={money(totales.trasladados)} />
              )}
              {totales.retenidos > 0 && (
                <Renglon etiqueta="Retenciones" valor={`− ${money(totales.retenidos)}`} />
              )}
              <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
                <span className="text-[13px] font-semibold text-ink">Total</span>
                <span className="font-mono text-xl font-bold tracking-tight text-ink">
                  {money(totales.total)}
                </span>
              </div>
            </CardBody>
          </>
        )}
      </Card>
    </div>
  );
}

/* ========================================================================== */
/* Resultado                                                                  */
/* ========================================================================== */

export function ResultadoTimbrado({
  uuid,
  fechaTimbrado,
  onOtra,
}: {
  uuid: string;
  fechaTimbrado: string;
  onOtra: () => void;
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-bg text-xl text-ok"
          aria-hidden
        >
          ✓
        </span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">Factura timbrada</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          Ya quedó registrada ante el SAT el {fechaHora(fechaTimbrado)}.
        </p>
        <p className="mt-4 break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-[12px] text-ink">
          {uuid}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/facturas" className={buttonClass("secondary")}>
            Ver mis facturas
          </Link>
          <Button variant="primary" onClick={onOtra}>
            Timbrar otra
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ========================================================================== */
/* Auxiliares                                                                 */
/* ========================================================================== */

function Dato({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-line-2 py-1.5 last:border-0">
      <span className="shrink-0 text-[12.5px] text-ink-3">{etiqueta}</span>
      <span
        className={cx("text-right text-[12.5px] font-semibold text-ink", mono && "font-mono")}
      >
        {valor || "—"}
      </span>
    </div>
  );
}

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className="font-mono text-[13px] font-semibold text-ink">{valor}</span>
    </div>
  );
}
