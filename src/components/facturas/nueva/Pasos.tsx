"use client";

/*
   Pasos del asistente de factura y nota de crédito. Cada uno es el cuerpo de
   una pantalla: la pregunta, el porqué y los botones de avanzar los pone el
   asistente alrededor, así que aquí no hay tarjetas ni encabezados propios.
*/

import { useState } from "react";
import Link from "next/link";
import { Button, Field, FieldError, Input, Note, Select, cx } from "@/components/ui";
import { FORMAS_PAGO, MONEDAS } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import { SelectorCatalogoSat } from "@/components/catalogosSat/SelectorCatalogoSat";
import {
  usosCompatibles,
  type ResultadoRegimenFiscal,
  type ResultadoUsoCfdi,
} from "@/lib/catalogoSatBusquedaShared";
import { useCatalogoSat } from "@/lib/useCatalogoSat";
import { ConceptoEditor } from "../ConceptoEditor";
import {
  CONCEPTO_VACIO,
  EXPORTACIONES,
  OBSERVACIONES_MAX,
  PERIODICIDADES,
  RFC_PUBLICO_GENERAL,
  TIPOS_RELACION,
  TIPOS_RELACION_FACTURA,
  calcularTotales,
  etiquetaTipo,
  llevaGlobal,
  mesesPara,
  type FacturaBorrador,
  type Paso,
  type PasoId,
  type Problema,
} from "@/lib/facturaNueva";
import { COMPLEMENTOS, activos } from "@/lib/complementos";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";

export type Comun = {
  borrador: FacturaBorrador;
  set: (cambios: Partial<FacturaBorrador>) => void;
  problemas: Problema[];
  mostrarErrores: boolean;
};

function mensajeDe(problemas: Problema[], campo: string, mostrar: boolean) {
  if (!mostrar) return undefined;
  return problemas.find((p) => p.campo === campo)?.mensaje;
}

/* -------------------------------------------------------------------------- */
/* Piezas                                                                     */
/* -------------------------------------------------------------------------- */

/** Una opción elegible con su marca, como las del mockup aprobado. */
function Opcion({
  activa,
  onClick,
  titulo,
  detalle,
  multiple,
  derecha,
  disabled,
}: {
  activa: boolean;
  onClick: () => void;
  titulo: React.ReactNode;
  detalle?: React.ReactNode;
  /** Casilla cuadrada en vez de círculo: se pueden marcar varias. */
  multiple?: boolean;
  derecha?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={activa}
      className={cx(
        "focus-brand flex w-full items-start gap-3 rounded-xl border bg-surface px-3.5 py-3 text-left transition",
        activa
          ? "border-brand shadow-[0_0_0_3px_var(--brand-050)]"
          : "border-line hover:border-ink-4",
        disabled && "cursor-not-allowed bg-surface-2 opacity-60 hover:border-line"
      )}
    >
      <span
        aria-hidden
        className={cx(
          "mt-0.5 size-[18px] flex-none border-[1.5px]",
          multiple ? "rounded-[5px]" : "rounded-full",
          activa
            ? "border-brand bg-brand shadow-[inset_0_0_0_3px_var(--surface)]"
            : "border-ink-4"
        )}
      />
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-semibold text-ink">{titulo}</span>
        {detalle && <span className="mt-0.5 block text-[12.5px] text-ink-3">{detalle}</span>}
      </span>
      {derecha && <span className="shrink-0 text-right">{derecha}</span>}
    </button>
  );
}

function Plegable({
  titulo,
  resumen,
  abierto,
  onAlternar,
  children,
}: {
  titulo: string;
  resumen: string;
  abierto: boolean;
  onAlternar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line bg-surface">
      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
        <div className="min-w-0">
          <p className="text-[13.5px] font-semibold text-ink">{titulo}</p>
          {!abierto && <p className="truncate text-[12.5px] text-ink-3">{resumen}</p>}
        </div>
        <Button variant="ghost" size="sm" onClick={onAlternar} aria-expanded={abierto}>
          {abierto ? "Listo" : "Cambiar"}
        </Button>
      </div>
      {abierto && <div className="border-t border-line-2 px-3.5 py-3.5">{children}</div>}
    </div>
  );
}

/** Lista de folios fiscales relacionados, con su botón de quitar. */
function ListaUuids({
  uuids,
  onQuitar,
}: {
  uuids: string[];
  onQuitar: (uuid: string) => void;
}) {
  return (
    <ul className="space-y-2">
      {uuids.map((uuid) => (
        <li
          key={uuid}
          className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-2 px-3 py-2"
        >
          <span className="min-w-0 break-all font-mono text-[11.5px] text-ink">{uuid}</span>
          <Button variant="danger" size="sm" onClick={() => onQuitar(uuid)}>
            Quitar
          </Button>
        </li>
      ))}
    </ul>
  );
}

/* ========================================================================== */
/* Emisor y serie                                                             */
/* ========================================================================== */

export function PasoEmisor({
  borrador,
  set,
  problemas,
  mostrarErrores,
  emisores,
  series,
  cargandoSeries,
}: Comun & {
  emisores: Emisor[];
  series: Serie[];
  cargandoSeries: boolean;
}) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const emisor = emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;
  const sinCsd = emisor && (!emisor.Cert || !emisor.Key);
  // Si hay un error en la parte plegada, se abre sola: esconder el campo que
  // falta sería peor que no plegarlo.
  const [abierto, setAbierto] = useState(false);
  const conError = Boolean(err("fechaEmision") || err("tipoCambio"));

  const resumen = [
    borrador.fechaActual ? "Fecha de hoy" : borrador.fechaEmision.replace("T", " "),
    borrador.moneda + (borrador.moneda !== "MXN" && borrador.tipoCambio ? ` a ${borrador.tipoCambio}` : ""),
    EXPORTACIONES.find((e) => e.value === borrador.exportacion)?.label ?? borrador.exportacion,
  ].join(" · ");

  return (
    <div className="space-y-4">
      <Field label="Emisor">
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
        <Note tone="danger" title="Este emisor no tiene CSD">
          Sin certificado de sello digital no se puede timbrar.{" "}
          <Link
            href={`/emisores/${encodeURIComponent(borrador.rfcEmisor)}/csd`}
            className="font-semibold underline"
          >
            Subir el certificado
          </Link>
        </Note>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Serie" hint={`Solo se listan las series de tipo ${etiquetaTipo(borrador.tipo)}.`}>
          <Select
            value={borrador.serie}
            disabled={!borrador.rfcEmisor || cargandoSeries}
            onChange={(e) => set({ serie: e.target.value, folio: "" })}
            aria-invalid={Boolean(err("serie"))}
          >
            <option value="">{cargandoSeries ? "Cargando series…" : "Selecciona una serie"}</option>
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

        <Field label="Folio" hint="Se asigna solo: el siguiente de la serie.">
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
      </div>

      {borrador.tipo !== "P" && (
        <Plegable
          titulo="Fecha, moneda y exportación"
          resumen={resumen}
          abierto={abierto || (mostrarErrores && conError)}
          onAlternar={() => setAbierto((v) => !v)}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Field label="Fecha de emisión">
                <input
                  type="datetime-local"
                  className="focus-brand w-full rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink focus:border-brand disabled:bg-surface-2 disabled:text-ink-3"
                  value={borrador.fechaEmision}
                  disabled={borrador.fechaActual}
                  onChange={(e) => set({ fechaEmision: e.target.value })}
                  aria-invalid={Boolean(err("fechaEmision"))}
                />
              </Field>
              <label className="flex items-center gap-2 text-[12.5px] text-ink-2">
                <input
                  type="checkbox"
                  checked={borrador.fechaActual}
                  onChange={(e) => set({ fechaActual: e.target.checked })}
                  className="size-4 accent-[var(--brand)]"
                />
                Usar la fecha y hora de timbrar
              </label>
              <FieldError mensaje={err("fechaEmision")} />
            </div>

            <Field label="Exportación">
              <Select value={borrador.exportacion} onChange={(e) => set({ exportacion: e.target.value })}>
                {EXPORTACIONES.map((x) => (
                  <option key={x.value} value={x.value}>
                    {x.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Moneda">
              <Select
                value={borrador.moneda}
                onChange={(e) => set({ moneda: e.target.value, tipoCambio: e.target.value === "MXN" ? "" : borrador.tipoCambio })}
              >
                {MONEDAS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>

            {borrador.moneda !== "MXN" && (
              <Field label="Tipo de cambio" hint="Pesos por cada unidad de la moneda.">
                <Input
                  inputMode="decimal"
                  placeholder="Ej. 18.2415"
                  value={borrador.tipoCambio}
                  onChange={(e) => set({ tipoCambio: e.target.value })}
                  aria-invalid={Boolean(err("tipoCambio"))}
                  className="font-mono"
                />
                <FieldError mensaje={err("tipoCambio")} />
              </Field>
            )}
          </div>
        </Plegable>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Receptor                                                                   */
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

  const regimenes = useCatalogoSat<ResultadoRegimenFiscal>("regimenFiscal");
  const usos = useCatalogoSat<ResultadoUsoCfdi>("usoCfdi");
  // El régimen del receptor acota qué usos son válidos: el SAT rechaza el CFDI
  // si no coinciden.
  const usosParaEsteReceptor = usosCompatibles(usos, receptorActual?.RegimenFiscal ?? "");
  const regimen = regimenes.find((r) => r.id === receptorActual?.RegimenFiscal);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <Field label="Receptor">
          <Select
            value={borrador.receptorRfc}
            disabled={cargandoReceptores}
            onChange={(e) => {
              const rfc = e.target.value;
              const r = rfc === RFC_PUBLICO_GENERAL ? null : receptores.find((x) => x.Rfc === rfc);
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
        <Button variant="secondary" onClick={onNuevoReceptor} disabled={!borrador.rfcEmisor}>
          Nuevo receptor
        </Button>
      </div>

      <Field label="Uso del CFDI" hint="Solo ves los usos que el SAT permite con el régimen de este receptor.">
        <SelectorCatalogoSat<ResultadoUsoCfdi>
          opciones={usosParaEsteReceptor}
          value={borrador.usoCfdi}
          placeholder="Busca por nombre o clave"
          invalid={Boolean(err("usoCfdi"))}
          onChange={(u) => set({ usoCfdi: u.id })}
        />
        <FieldError mensaje={err("usoCfdi")} />
      </Field>

      {borrador.tipo === "E" && borrador.usoCfdi !== "G02" && (
        <Note tone="warn">
          Para una nota de crédito lo habitual es el uso{" "}
          <strong>G02 - Devoluciones, descuentos o bonificaciones</strong>.
        </Note>
      )}

      {esGenerico ? (
        <>
          <Note tone="info">
            Con Público en general el uso del CFDI es <strong>S01 Sin efectos fiscales</strong>, el
            régimen 616 y el código postal es el del emisor, como pide el SAT.
          </Note>
          {llevaGlobal(borrador) && (
            <BloqueGlobal borrador={borrador} set={set} problemas={problemas} mostrarErrores={mostrarErrores} />
          )}
        </>
      ) : (
        receptorActual && (
          <div className="rounded-xl border border-line bg-surface-2 p-3.5">
            <p className="text-[12.5px] font-semibold text-ink-2">Datos fiscales que van en el CFDI</p>
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-[12.5px] sm:grid-cols-2">
              <Linea etiqueta="Razón social" valor={receptorActual.Nombre} />
              <Linea etiqueta="RFC" valor={receptorActual.Rfc} mono />
              <Linea
                etiqueta="Régimen fiscal"
                valor={regimen ? `${regimen.id} - ${regimen.texto}` : receptorActual.RegimenFiscal}
              />
              <Linea etiqueta="Código postal" valor={receptorActual.DomicilioFiscal} mono />
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
    </div>
  );
}

/** Información global: aparece sola al elegir Público en general en una factura. */
function BloqueGlobal({ borrador, set, problemas, mostrarErrores }: Comun) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const g = borrador.global;
  const meses = mesesPara(g.periodicidad);
  const anioActual = new Date().getFullYear();

  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <p className="text-[13.5px] font-semibold text-ink">Información global</p>
      <p className="mt-0.5 text-[12.5px] text-ink-3">
        Es la factura de tus ventas de mostrador del periodo. El SAT la pide con Público en general.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-3">
        <Field label="Periodicidad">
          <Select
            value={g.periodicidad}
            onChange={(e) => {
              const periodicidad = e.target.value;
              // Bimestral usa los meses 13-18; los demás, 01-12.
              const validos = mesesPara(periodicidad);
              const mes = validos.some((m) => m.value === g.meses)
                ? g.meses
                : periodicidad === "05"
                  ? String(Math.ceil(Number(g.meses || 1) / 2) + 12)
                  : String(new Date().getMonth() + 1).padStart(2, "0");
              set({ global: { ...g, periodicidad, meses: mes } });
            }}
            aria-invalid={Boolean(err("global.periodicidad"))}
          >
            {PERIODICIDADES.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("global.periodicidad")} />
        </Field>
        <Field label={g.periodicidad === "05" ? "Bimestre" : "Mes"}>
          <Select
            value={g.meses}
            onChange={(e) => set({ global: { ...g, meses: e.target.value } })}
            aria-invalid={Boolean(err("global.meses"))}
          >
            <option value="">Elige…</option>
            {meses.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("global.meses")} />
        </Field>
        <Field label="Año">
          <Select
            value={g.anio}
            onChange={(e) => set({ global: { ...g, anio: e.target.value } })}
            aria-invalid={Boolean(err("global.anio"))}
          >
            {[anioActual - 1, anioActual].map((a) => (
              <option key={a} value={String(a)}>
                {a}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("global.anio")} />
        </Field>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Conceptos                                                                  */
/* ========================================================================== */

export function PasoConceptos({ borrador, set, problemas, mostrarErrores }: Comun) {
  const totales = calcularTotales(borrador.conceptos, borrador.complementos);

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
    <div className="space-y-3">
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
          onRemove={() => set({ conceptos: borrador.conceptos.filter((_, idx) => idx !== i) })}
        />
      ))}

      {mostrarErrores &&
        generales.map((p) => (
          <Note key={p.mensaje} tone="danger">
            {p.mensaje}
          </Note>
        ))}

      <div className="flex flex-wrap items-start justify-between gap-4 pt-1">
        <Button
          variant="secondary"
          onClick={() => set({ conceptos: [...borrador.conceptos, { ...CONCEPTO_VACIO }] })}
        >
          Agregar concepto
        </Button>
        <div className="ml-auto w-full max-w-xs space-y-1">
          <Renglon etiqueta="Subtotal" valor={money(totales.subtotal, borrador.moneda)} />
          {totales.trasladados > 0 && (
            <Renglon etiqueta="Impuestos trasladados" valor={money(totales.trasladados, borrador.moneda)} />
          )}
          {totales.retenidos > 0 && (
            <Renglon etiqueta="Retenciones" valor={`− ${money(totales.retenidos, borrador.moneda)}`} />
          )}
          {totales.localesTrasladados > 0 && (
            <Renglon etiqueta="Impuestos locales" valor={money(totales.localesTrasladados, borrador.moneda)} />
          )}
          {totales.localesRetenidos > 0 && (
            <Renglon etiqueta="Retenciones locales" valor={`− ${money(totales.localesRetenidos, borrador.moneda)}`} />
          )}
          <div className="flex items-baseline justify-between gap-4 border-t border-line pt-1.5">
            <span className="text-[13px] font-semibold text-ink">Total</span>
            <span className="font-mono text-lg font-bold tracking-tight text-ink">
              {money(totales.total, borrador.moneda)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Forma de pago                                                              */
/* ========================================================================== */

export function PasoFormaPago({ borrador, set, problemas, mostrarErrores }: Comun) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const ppd = borrador.metodoPago === "PPD";

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Opcion
          activa={borrador.metodoPago === "PUE"}
          onClick={() =>
            set({ metodoPago: "PUE", formaPago: borrador.formaPago === "99" ? "03" : borrador.formaPago })
          }
          titulo={borrador.tipo === "E" ? "Se lo regreso en una sola exhibición" : "Me pagan en una sola exhibición"}
          detalle="PUE · el pago ya se hizo o se hace hoy"
        />
        <Opcion
          activa={ppd}
          onClick={() => set({ metodoPago: "PPD", formaPago: "99" })}
          titulo={borrador.tipo === "E" ? "Se lo regreso después o en parcialidades" : "Me pagan después o en parcialidades"}
          detalle="PPD · por cada pago que recibas emitirás un complemento de pago"
        />
      </div>
      <FieldError mensaje={err("metodoPago")} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Forma de pago"
          hint={ppd ? "Con PPD es 99 Por definir; la forma real va en cada complemento de pago." : undefined}
        >
          <Select
            value={borrador.formaPago}
            disabled={ppd}
            onChange={(e) => set({ formaPago: e.target.value })}
            aria-invalid={Boolean(err("formaPago"))}
          >
            {FORMAS_PAGO.filter((f) => ppd || f.value !== "99").map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
          <FieldError mensaje={err("formaPago")} />
        </Field>

        <Field label="Condiciones de pago (opcional)">
          <Input
            placeholder="Ej. 30 días"
            value={borrador.condicionesDePago}
            onChange={(e) => set({ condicionesDePago: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* Factura que corrige (nota de crédito)                                      */
/* ========================================================================== */

export function PasoOrigen({
  borrador,
  set,
  problemas,
  mostrarErrores,
  onAbrirRelacion,
}: Comun & { onAbrirRelacion: () => void }) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const r = borrador.relacion;

  return (
    <div className="space-y-4">
      <Field label="¿Por qué la corriges?">
        <Select value={r.tipoRelacion} onChange={(e) => set({ relacion: { ...r, tipoRelacion: e.target.value } })}>
          {TIPOS_RELACION.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
        <FieldError mensaje={err("tipoRelacion")} />
      </Field>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-ink-2">Facturas que corrige</p>
        <Button
          variant={r.uuids.length === 0 ? "primary" : "secondary"}
          onClick={onAbrirRelacion}
          disabled={!borrador.rfcEmisor}
        >
          {r.uuids.length === 0 ? "Buscar factura" : "Agregar otra"}
        </Button>
      </div>

      {r.uuids.length === 0 ? (
        <Note tone={err("relacion") ? "danger" : "warn"}>
          {err("relacion") ??
            "Todavía no eliges la factura. Búscala en tus facturas timbradas o pega su folio fiscal."}
        </Note>
      ) : (
        <>
          <ListaUuids
            uuids={r.uuids}
            onQuitar={(u) => set({ relacion: { ...r, uuids: r.uuids.filter((x) => x !== u) } })}
          />
          <FieldError mensaje={err("relacion")} />
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/* CFDI relacionados (factura)                                                */
/* ========================================================================== */

export function PasoRelacion({
  borrador,
  set,
  problemas,
  mostrarErrores,
  onAbrirRelacion,
}: Comun & { onAbrirRelacion: () => void }) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const r = borrador.relacion;

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        <Opcion
          activa={!borrador.relacionar}
          onClick={() => set({ relacionar: false })}
          titulo="No se relaciona"
          detalle="Es una factura independiente (lo más común)"
        />
        <Opcion
          activa={borrador.relacionar}
          onClick={() => set({ relacionar: true })}
          titulo="Sí, se relaciona con otras facturas"
          detalle="Sustituye a una cancelada, aplica un anticipo o viene de un traslado"
        />
      </div>

      {borrador.relacionar && (
        <>
          <Field
            label="Tipo de relación"
            hint="Las de nota de crédito, débito y devolución se hacen desde “Nota de crédito”."
          >
            <Select value={r.tipoRelacion} onChange={(e) => set({ relacion: { ...r, tipoRelacion: e.target.value } })}>
              {TIPOS_RELACION_FACTURA.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] font-semibold text-ink-2">Facturas relacionadas</p>
            <Button
              variant={r.uuids.length === 0 ? "primary" : "secondary"}
              onClick={onAbrirRelacion}
              disabled={!borrador.rfcEmisor}
            >
              {r.uuids.length === 0 ? "Buscar factura" : "Agregar otra"}
            </Button>
          </div>

          {r.uuids.length === 0 ? (
            <Note tone={err("relacion") ? "danger" : "info"}>
              {err("relacion") ?? "Búscala en tus facturas timbradas o pega su folio fiscal (UUID)."}
            </Note>
          ) : (
            <>
              <ListaUuids
                uuids={r.uuids}
                onQuitar={(u) => set({ relacion: { ...r, uuids: r.uuids.filter((x) => x !== u) } })}
              />
              <FieldError mensaje={err("relacion")} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ========================================================================== */
/* Complementos                                                               */
/* ========================================================================== */

export function PasoComplementos({ borrador, set, problemas, mostrarErrores }: Comun) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const lista = activos(borrador.complementos);

  function alternar(id: string) {
    const def = COMPLEMENTOS.find((c) => c.id === id);
    if (!def || !def.disponible) return;
    const siguiente = { ...borrador.complementos };
    if (id in siguiente) delete siguiente[id];
    else siguiente[id] = { ...def.porDefecto };
    set({ complementos: siguiente });
  }

  function cambiar(id: string, campo: string, valor: string) {
    set({
      complementos: {
        ...borrador.complementos,
        [id]: { ...borrador.complementos[id], [campo]: valor },
      },
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {COMPLEMENTOS.map((c) => (
          <Opcion
            key={c.id}
            multiple
            activa={c.id in borrador.complementos}
            onClick={() => alternar(c.id)}
            disabled={!c.disponible}
            titulo={c.nombre}
            detalle={c.disponible ? c.descripcion : `${c.descripcion} Próximamente.`}
          />
        ))}
      </div>

      {lista.length === 0 ? (
        <p className="text-[13px] text-ink-3">Sin complementos. Si tu factura no lleva ninguno, solo continúa.</p>
      ) : (
        lista.map((def) => {
          const datos = borrador.complementos[def.id];
          return (
            <div key={def.id} className="rounded-xl border border-line bg-surface p-3.5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[13.5px] font-semibold text-ink">{def.nombre}</p>
                <Button variant="ghost" size="sm" onClick={() => alternar(def.id)}>
                  Quitar
                </Button>
              </div>
              {def.destino === "concepto" && (
                <p className="mt-0.5 text-[12.5px] text-ink-3">Se agrega a cada concepto de la factura.</p>
              )}
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                {def.campos.map((campo) => {
                  const clave = `complemento.${def.id}.${campo.id}`;
                  return (
                    <Field
                      key={campo.id}
                      label={campo.obligatorio ? campo.etiqueta : `${campo.etiqueta} (opcional)`}
                      hint={campo.ayuda}
                    >
                      {campo.opciones ? (
                        <Select value={datos[campo.id] ?? ""} onChange={(e) => cambiar(def.id, campo.id, e.target.value)}>
                          {campo.opciones.map((o) => (
                            <option key={o.value} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </Select>
                      ) : (
                        <Input
                          value={datos[campo.id] ?? ""}
                          placeholder={campo.placeholder}
                          inputMode={campo.numerico ? "decimal" : undefined}
                          onChange={(e) => cambiar(def.id, campo.id, e.target.value)}
                          aria-invalid={Boolean(err(clave))}
                          className={campo.numerico ? "font-mono" : undefined}
                        />
                      )}
                      <FieldError mensaje={err(clave)} />
                    </Field>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

/* ========================================================================== */
/* Revisar y timbrar                                                          */
/* ========================================================================== */

export type FilaResumen = { paso: PasoId; etiqueta: string; valor: string; detalle?: string };

export function PasoRevision({
  borrador,
  set,
  problemas,
  mostrarErrores,
  pasos,
  problemasPorPaso,
  filas,
  onIrA,
}: Comun & {
  pasos: Paso[];
  problemasPorPaso: Record<PasoId, Problema[]>;
  filas: FilaResumen[];
  onIrA: (paso: PasoId) => void;
}) {
  const err = (campo: string) => mensajeDe(problemas, campo, mostrarErrores);
  const conProblemas = pasos.filter((p) => p.id !== "revision" && problemasPorPaso[p.id].length > 0);
  const faltan = conProblemas.reduce((n, p) => n + problemasPorPaso[p.id].length, 0);

  return (
    <div className="space-y-4">
      {conProblemas.length > 0 ? (
        <Note tone="warn" title={`Falta${faltan === 1 ? "" : "n"} ${faltan} dato${faltan === 1 ? "" : "s"} para timbrar`}>
          <ul className="mt-1 space-y-1">
            {conProblemas.flatMap((p) =>
              problemasPorPaso[p.id].map((prob) => (
                <li key={p.id + prob.campo + prob.mensaje}>
                  {p.titulo}: {prob.mensaje}{" "}
                  <button type="button" onClick={() => onIrA(p.id)} className="font-semibold underline">
                    Corregir
                  </button>
                </li>
              ))
            )}
          </ul>
        </Note>
      ) : (
        <Note tone="ok" title="Todo listo">
          Revisa el resumen y timbra. Al hacerlo se consume un timbre y el comprobante queda registrado ante el SAT.
        </Note>
      )}

      <div className="overflow-hidden rounded-xl border border-line bg-surface">
        {filas.map((f, i) => (
          <div
            key={f.etiqueta}
            className={cx(
              "grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-0.5 px-3.5 py-3 sm:grid-cols-[150px_minmax(0,1fr)_auto]",
              i > 0 && "border-t border-line-2"
            )}
          >
            <span className="col-span-2 text-[12.5px] font-semibold text-ink-3 sm:col-span-1">{f.etiqueta}</span>
            <span className="min-w-0">
              <span className="block break-words text-[13px] text-ink">{f.valor}</span>
              {f.detalle && <span className="block text-[12px] text-ink-3">{f.detalle}</span>}
            </span>
            <button
              type="button"
              onClick={() => onIrA(f.paso)}
              className="focus-brand self-start rounded text-[12.5px] font-semibold text-brand underline decoration-1 underline-offset-[3px] hover:text-brand-600"
            >
              Cambiar
            </button>
          </div>
        ))}
      </div>

      <Field
        label="Observaciones (opcional)"
        hint="Van en el comprobante como addenda de Factubox, con tu usuario y la fecha y hora del timbrado. No las revisa el SAT."
      >
        <textarea
          rows={3}
          maxLength={OBSERVACIONES_MAX}
          placeholder="Ej. Pedido 4471. Entregar en almacén norte."
          value={borrador.observaciones}
          onChange={(e) => set({ observaciones: e.target.value })}
          className="focus-brand w-full resize-y rounded-[10px] border border-line bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-4 focus:border-brand"
        />
        <span className="self-end text-[11.5px] tabular-nums text-ink-4">
          {borrador.observaciones.length} / {OBSERVACIONES_MAX}
        </span>
        <FieldError mensaje={err("observaciones")} />
      </Field>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Linea({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-0.5">
      <dt className="shrink-0 text-ink-3">{etiqueta}</dt>
      <dd className={cx("text-right font-semibold text-ink", mono && "font-mono")}>{valor || "—"}</dd>
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
