"use client";

/*
   Pantallas que se quedaron del asistente anterior: el paso de pago del
   complemento (que se rediseña aparte), el resultado del timbrado y la
   revisión contra el SAT. Los pasos de factura y nota de crédito viven en
   ./nueva/Pasos.tsx.
*/

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
  buttonClass,
} from "@/components/ui";
import { FORMAS_PAGO, MONEDAS } from "@/lib/catalogosSat";
import { fechaHora, money } from "@/lib/cfdi";
import { ElegirFacturaOrigenModal } from "./ElegirFacturaOrigenModal";
import type { FacturaBorrador, PagoBorrador, Problema } from "@/lib/facturaNueva";
import type { HallazgoSat } from "@/lib/timbrado";

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
/* Resultado                                                                  */
/* ========================================================================== */

export function ResultadoTimbrado({
  titulo,
  uuid,
  fechaTimbrado,
  onOtra,
}: {
  /** Ej. "Factura timbrada", "Nota de crédito timbrada". */
  titulo: string;
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
        <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">{titulo}</h2>
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
            Hacer otro comprobante
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* ========================================================================== */
/* Auxiliares                                                                 */
/* ========================================================================== */

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className="font-mono text-[13px] font-semibold text-ink">{valor}</span>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Revisión contra el SAT                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resultado de pasar el comprobante ya armado y sellado por los esquemas,
 * catálogos y reglas del SAT, en el servidor.
 *
 * Es distinto del panel de "Falta información": ese revisa el borrador y ve
 * campos vacíos; esto revisa el XML que de verdad va a recibir el PAC y ve lo
 * que solo se nota con el comprobante hecho — que los importes no cuadren, que
 * el uso del CFDI no vaya con el régimen del receptor, que la clave ya no esté
 * vigente.
 *
 * Un fallo de la revisión no es lo mismo que un comprobante malo: si el
 * servidor no pudo revisar, se dice y se deja timbrar. No tiene sentido dejar
 * a alguien sin facturar porque nuestra revisión se cayó.
 */
export function RevisionSat({
  revisando,
  hayResultado,
  errores,
  advertencias,
  noRevisado,
  motivoFallo,
  onReintentar,
}: {
  revisando: boolean;
  /** Hay un veredicto para el comprobante tal como está ahora. */
  hayResultado: boolean;
  errores: HallazgoSat[];
  advertencias: HallazgoSat[];
  /** Capas del validador que no se pudieron correr, con el motivo. */
  noRevisado: string[];
  /** Por qué no se pudo revisar, si es que no se pudo. */
  motivoFallo: string | null;
  onReintentar: () => void;
}) {
  if (revisando) {
    return (
      <Note tone="info" title="Revisando ante el SAT…">
        Se está armando el comprobante y comparándolo con los esquemas y
        catálogos oficiales. No consume timbres.
      </Note>
    );
  }

  if (motivoFallo !== null) {
    return (
      <Note tone="warn" title="No se pudo revisar el comprobante">
        {motivoFallo} Puedes timbrar de todas formas, pero sin esta comprobación
        el PAC podría rechazarlo y el timbre se consumiría igual.{" "}
        <button
          type="button"
          onClick={onReintentar}
          className="font-semibold underline underline-offset-2"
        >
          Reintentar
        </button>
      </Note>
    );
  }

  if (!hayResultado) {
    return null;
  }

  return (
    <div className="space-y-3">
      {errores.length > 0 && (
        <Card>
          <CardHeader
            title={
              errores.length === 1
                ? "El SAT rechazaría este comprobante"
                : `El SAT rechazaría este comprobante (${errores.length} motivos)`
            }
            description="Se revisó el CFDI ya armado y sellado. Hay que corregir esto antes de timbrar; si se manda así, el timbre se consume y el comprobante no se emite."
          />
          <CardBody className="space-y-1.5">
            {errores.map((e, i) => (
              <div
                key={e.campo + i}
                className="rounded-xl border border-danger/40 bg-danger-bg px-3.5 py-2.5"
              >
                <p className="font-mono text-[11.5px] font-semibold text-danger">{e.campo}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-danger">{e.mensaje}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {errores.length === 0 && noRevisado.length === 0 && (
        <Note tone="ok" title="El comprobante pasa las reglas del SAT">
          Se revisó contra los esquemas oficiales, los catálogos vigentes y el
          sello. Nada de esto consumió timbres.
        </Note>
      )}

      {/* Cuando alguna capa no corrió, el visto bueno vale menos de lo que
          parece: decir "pasa las reglas del SAT" habiendo revisado tres cuartas
          partes es peor que no decir nada, porque el usuario timbra confiado.
          Se muestra también junto a los errores — saber que encima faltó
          revisar algo cambia lo que uno hace después de corregir. */}
      {noRevisado.length > 0 && (
        <Note
          tone="warn"
          title={
            errores.length === 0
              ? "El comprobante pasa lo que se pudo revisar"
              : "Además, quedó algo sin revisar"
          }
        >
          <ul className="mt-1 space-y-1">
            {noRevisado.map((motivo, i) => (
              <li key={motivo + i}>· {motivo}</li>
            ))}
          </ul>
          <p className="mt-1.5 opacity-80">
            Puedes timbrar, pero de esa parte no hay quien avise antes que el
            PAC.
          </p>
        </Note>
      )}

      {advertencias.length > 0 && (
        <Note
          tone="warn"
          title={
            advertencias.length === 1
              ? "Un detalle que conviene revisar"
              : `${advertencias.length} detalles que conviene revisar`
          }
        >
          <ul className="mt-1 space-y-1">
            {advertencias.map((a, i) => (
              <li key={a.campo + i}>
                · <span className="font-mono text-[11.5px]">{a.campo}</span> {a.mensaje}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 opacity-80">Esto no impide timbrar.</p>
        </Note>
      )}
    </div>
  );
}
