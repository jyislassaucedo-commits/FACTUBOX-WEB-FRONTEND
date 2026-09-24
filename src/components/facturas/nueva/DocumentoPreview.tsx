"use client";

import { useState } from "react";
import { cx } from "@/components/ui";
import { FORMAS_PAGO } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import {
  MESES,
  PERIODICIDADES,
  TIPOS_RELACION,
  TIPOS_RELACION_FACTURA,
  calcularTotales,
  etiquetaTipo,
  llevaGlobal,
  type FacturaBorrador,
  type PasoId,
} from "@/lib/facturaNueva";
import { activos } from "@/lib/complementos";
import { cadena, complementosPorReceptor, folioDe, montoDe, ordenarPagos, totalEnPesos } from "@/lib/pagosCaptura";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";

/*
   El comprobante armándose a la derecha, con cada paso. Resalta la sección
   que se está llenando y deja un hueco con "se llena en el paso…" en lo que
   todavía no se ha visitado, para que se vea qué falta sin leer una lista.
*/

const NOMBRE_TIPO: Record<string, string> = {
  I: "Factura",
  E: "Nota de crédito",
  P: "Complemento de pago",
};

export function DocumentoPreview({
  borrador,
  emisor,
  receptor,
  pasoActual,
  visto,
  titulos,
  editandoPago = false,
}: {
  borrador: FacturaBorrador;
  emisor: Emisor | null;
  receptor: Receptor | null;
  pasoActual: PasoId;
  /** Pasos ya visitados: lo demás se ve como hueco. */
  visto: (paso: PasoId) => boolean;
  titulos: Partial<Record<PasoId, string>>;
  /** Hay un pago a medio armar: aparece aquí al guardarlo. */
  editandoPago?: boolean;
}) {
  const b = borrador;
  const esPago = b.tipo === "P";
  const totales = calcularTotales(b.conceptos, b.complementos);
  const lleno = (paso: PasoId) => visto(paso) || pasoActual === paso;

  const folio = b.serie && b.folio ? `${b.serie}-${b.folio}` : "—";

  return (
    // Es papel: se queda en tema claro aunque la app esté en oscuro.
    <div
      data-theme="light"
      aria-label="Vista previa del comprobante"
      className="grid gap-3 rounded-md border border-line bg-white p-5 text-[12.5px] text-[#0f1621] shadow-[0_18px_40px_rgb(16_24_40_/_0.10)]"
    >
      <div className="flex items-start justify-between gap-3 border-b-2 border-[#0f1621] pb-3">
        <div>
          <p className="text-[11px] text-ink-3">CFDI 4.0 · {etiquetaTipo(b.tipo)}</p>
          <p className="text-[17px] font-extrabold tracking-tight">{NOMBRE_TIPO[b.tipo]}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] text-ink-3">Serie y folio</p>
          <p className="font-mono text-[15px] font-bold">{folio}</p>
        </div>
      </div>

      <Seccion actual={pasoActual} pasos={["emisor"]} etiqueta="Emisor">
        <p className="font-semibold">{emisor?.Nombre ?? "—"}</p>
        <p className="text-ink-2">
          {emisor?.Rfc ?? "—"} · CP {emisor?.LugarExp ?? "—"}
          {!esPago && ` · ${b.moneda}`}
        </p>
      </Seccion>

      {b.tipo === "E" && (
        <Seccion actual={pasoActual} pasos={["origen"]} etiqueta="Factura que corrige">
          {b.relacion.uuids.length > 0 ? (
            <>
              <p>{TIPOS_RELACION.find((t) => t.value === b.relacion.tipoRelacion)?.label}</p>
              {b.relacion.uuids.map((u) => (
                <p key={u} className="break-all font-mono text-[11px] text-ink-2">
                  {u}
                </p>
              ))}
            </>
          ) : (
            <Hueco titulo={titulos.origen ?? "origen"} />
          )}
        </Seccion>
      )}

      {esPago ? (
        <SeccionPagos borrador={b} pasoActual={pasoActual} editando={editandoPago} titulo={titulos.pagos ?? "pagos"} />
      ) : (
        <>
          <Seccion actual={pasoActual} pasos={["receptor"]} etiqueta="Receptor">
            {lleno("receptor") && receptor ? (
              <>
                <p className="font-semibold">{receptor.Nombre}</p>
                <p className="text-ink-2">
                  {receptor.Rfc} · uso {b.usoCfdi}
                </p>
              </>
            ) : (
              <Hueco titulo={titulos.receptor ?? "receptor"} />
            )}
          </Seccion>

          {llevaGlobal(b) && lleno("receptor") && (
            <Seccion actual={pasoActual} pasos={["receptor"]} etiqueta="Información global">
              <p>
                {PERIODICIDADES.find((p) => p.value === b.global.periodicidad)?.label ?? "—"} ·{" "}
                {MESES.find((m) => m.value === b.global.meses)?.label ?? "—"} · {b.global.anio}
              </p>
            </Seccion>
          )}

          <Seccion actual={pasoActual} pasos={["conceptos"]} etiqueta="Conceptos">
            {lleno("conceptos") ? (
              <table className="w-full border-collapse">
                <thead>
                  <tr className="text-left text-[11px] text-ink-3">
                    <th className="border-b border-line py-1 font-semibold">Descripción</th>
                    <th className="border-b border-line py-1 text-right font-semibold">Cant.</th>
                    <th className="border-b border-line py-1 text-right font-semibold">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {b.conceptos.map((c, i) => (
                    <tr key={i} className="align-top">
                      <td className="border-b border-line-2 py-1">
                        {c.descripcion || <span className="text-ink-4">Sin descripción</span>}
                        <span className="block font-mono text-[11px] text-ink-3">{c.claveProdServ || "—"}</span>
                      </td>
                      <td className="border-b border-line-2 py-1 text-right font-mono">{c.cantidad}</td>
                      <td className="border-b border-line-2 py-1 text-right font-mono">
                        {money(c.cantidad * c.valorUnitario, b.moneda)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <Hueco titulo={titulos.conceptos ?? "conceptos"} />
            )}
          </Seccion>

          <Seccion actual={pasoActual} pasos={["pago"]} etiqueta="Pago">
            {lleno("pago") ? (
              <p>
                {b.metodoPago} · {FORMAS_PAGO.find((f) => f.value === b.formaPago)?.label ?? b.formaPago}
                {b.condicionesDePago && ` · ${b.condicionesDePago}`}
              </p>
            ) : (
              <Hueco titulo={titulos.pago ?? "pago"} />
            )}
          </Seccion>

          {b.tipo === "I" && (
            <>
              <Seccion actual={pasoActual} pasos={["relacion"]} etiqueta="CFDI relacionados">
                {lleno("relacion") ? (
                  b.relacionar && b.relacion.uuids.length > 0 ? (
                    <>
                      <p>{TIPOS_RELACION_FACTURA.find((t) => t.value === b.relacion.tipoRelacion)?.label}</p>
                      {b.relacion.uuids.map((u) => (
                        <p key={u} className="break-all font-mono text-[11px] text-ink-2">
                          {u}
                        </p>
                      ))}
                    </>
                  ) : (
                    <p className="text-ink-2">Ninguno</p>
                  )
                ) : (
                  <Hueco titulo={titulos.relacion ?? "relacion"} />
                )}
              </Seccion>
              <Seccion actual={pasoActual} pasos={["complementos"]} etiqueta="Complementos">
                {lleno("complementos") ? (
                  <p className="text-ink-2">
                    {activos(b.complementos).map((c) => c.nombre).join(" · ") || "Ninguno"}
                  </p>
                ) : (
                  <Hueco titulo={titulos.complementos ?? "complementos"} />
                )}
              </Seccion>
            </>
          )}

          <div className="grid justify-items-end gap-0.5 font-mono tabular-nums">
            <Total etiqueta="Subtotal" valor={lleno("conceptos") ? money(totales.subtotal, b.moneda) : "—"} />
            {totales.trasladados > 0 && lleno("conceptos") && (
              <Total etiqueta="Impuestos" valor={money(totales.trasladados, b.moneda)} />
            )}
            {totales.retenidos > 0 && lleno("conceptos") && (
              <Total etiqueta="Retenciones" valor={`− ${money(totales.retenidos, b.moneda)}`} />
            )}
            {totales.localesTrasladados + totales.localesRetenidos > 0 && (
              <Total
                etiqueta="Locales"
                valor={money(totales.localesTrasladados - totales.localesRetenidos, b.moneda)}
              />
            )}
            <Total etiqueta="Total" valor={lleno("conceptos") ? money(totales.total, b.moneda) : "—"} grande />
          </div>
        </>
      )}

      {(pasoActual === "revision" || b.observaciones.trim()) && (
        <Seccion actual={pasoActual} pasos={["revision"]} etiqueta="Observaciones (addenda)">
          <p className={cx("break-words", !b.observaciones.trim() && "text-ink-4")}>
            {b.observaciones.trim() || "Sin observaciones"}
          </p>
        </Seccion>
      )}

      <p className="border-t border-dashed border-line pt-2.5 text-[11px] text-ink-3">
        El sello, el folio fiscal y el timbre se agregan al timbrar.
      </p>
    </div>
  );
}

function Total({ etiqueta, valor, grande }: { etiqueta: string; valor: string; grande?: boolean }) {
  return (
    <div className="flex gap-4">
      <span className="font-sans text-ink-3">{etiqueta}</span>
      <span className={cx(grande && "text-[16px] font-extrabold")}>{valor}</span>
    </div>
  );
}

function Seccion({
  actual,
  pasos,
  etiqueta,
  children,
}: {
  actual: PasoId;
  pasos: PasoId[];
  etiqueta: string;
  children: React.ReactNode;
}) {
  const aqui = pasos.includes(actual);
  return (
    <div
      className={cx(
        "-mx-2.5 rounded-lg px-2.5 py-2 transition-colors",
        aqui && "bg-brand-050 shadow-[inset_0_0_0_1.5px_var(--brand-100)]"
      )}
    >
      <p className="mb-0.5 text-[11px] font-semibold text-ink-3">{etiqueta}</p>
      {children}
    </div>
  );
}

function Hueco({ titulo }: { titulo: string }) {
  return (
    <p className="rounded-md border-[1.5px] border-dashed border-line px-2.5 py-2 text-[12px] text-ink-4">
      Se llena en el paso “{titulo}”
    </p>
  );
}

/** El complemento de pago: uno por receptor, con un selector si hay varios. */
function SeccionPagos({
  borrador: b,
  pasoActual,
  editando,
  titulo,
}: {
  borrador: FacturaBorrador;
  pasoActual: PasoId;
  editando: boolean;
  titulo: string;
}) {
  const comps = complementosPorReceptor(b.captura);
  const [elegido, setElegido] = useState<string | null>(null);
  const idx = Math.max(0, comps.findIndex((c) => c.receptor.rfc === elegido));
  const comp = comps[idx];
  const tramos = cadena(b.captura);

  return (
    <>
      {comps.length > 1 && (
        <div role="group" aria-label="Complemento que se muestra" className="flex flex-wrap gap-1">
          {comps.map((c, i) => (
            <button
              key={c.receptor.rfc}
              type="button"
              aria-pressed={i === idx}
              onClick={() => setElegido(c.receptor.rfc)}
              className={cx(
                "focus-brand max-w-[150px] truncate rounded-md border px-2 py-0.5 text-[11.5px] font-semibold",
                i === idx ? "border-[#0f1621] bg-[#0f1621] text-white" : "border-line text-ink-2"
              )}
            >
              {c.receptor.nombre}
            </button>
          ))}
        </div>
      )}

      <Seccion actual={pasoActual} pasos={["pagos"]} etiqueta="Receptor">
        {comp ? (
          <>
            <p className="font-semibold">{comp.receptor.nombre}</p>
            <p className="text-ink-2">{comp.receptor.rfc} · uso CP01 Pagos</p>
          </>
        ) : (
          <Hueco titulo={titulo} />
        )}
      </Seccion>

      <Seccion actual={pasoActual} pasos={["pagos"]} etiqueta="Pagos">
        {comp ? (
          <div className="space-y-2.5">
            {ordenarPagos(comp.pagos).map((p) => (
              <div key={p.id}>
                <p className="flex justify-between gap-3 font-semibold">
                  <span>
                    {p.fecha.split("-").reverse().join("/")} ·{" "}
                    {FORMAS_PAGO.find((f) => f.value === p.forma)?.label.slice(5) ?? p.forma}
                  </span>
                  <span className="font-mono">{money(montoDe(p), p.moneda)}</span>
                </p>
                <table className="mt-0.5 w-full border-collapse">
                  <thead>
                    <tr className="text-left text-[11px] text-ink-3">
                      <th className="border-b border-line py-0.5 font-semibold">Factura</th>
                      <th className="border-b border-line py-0.5 text-right font-semibold">Parc.</th>
                      <th className="border-b border-line py-0.5 text-right font-semibold">Pagado</th>
                      <th className="border-b border-line py-0.5 text-right font-semibold">Insoluto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.docs.map((d) => {
                      const f = b.captura.facturas[d.uuid];
                      const t = tramos[`${p.id}|${d.uuid}`];
                      if (!f || !t) return null;
                      return (
                        <tr key={d.uuid}>
                          <td className="border-b border-line-2 py-0.5 font-mono">{folioDe(f)}</td>
                          <td className="border-b border-line-2 py-0.5 text-right font-mono">{t.parcialidad}</td>
                          <td className="border-b border-line-2 py-0.5 text-right font-mono">{money(t.pagado, f.moneda)}</td>
                          <td className="border-b border-line-2 py-0.5 text-right font-mono">{money(t.insoluto, f.moneda)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        ) : (
          <Hueco titulo={titulo} />
        )}
        {editando && (
          <p className="mt-2 rounded-md bg-info-bg px-2.5 py-1.5 text-[11.5px] text-info">
            El pago que estás armando aparece aquí al guardarlo.
          </p>
        )}
      </Seccion>

      {b.relacionar && b.relacion.uuids.length > 0 && (
        <Seccion actual={pasoActual} pasos={["relacion"]} etiqueta="Sustituye a">
          {b.relacion.uuids.map((u) => (
            <p key={u} className="break-all font-mono text-[11px] text-ink-2">
              {u}
            </p>
          ))}
        </Seccion>
      )}

      <div className="flex items-baseline justify-end gap-4">
        <span className="text-ink-3">Total de pagos en pesos</span>
        <span className="font-mono text-[16px] font-extrabold">{money(comp ? totalEnPesos(comp.pagos) : 0)}</span>
      </div>
    </>
  );
}
