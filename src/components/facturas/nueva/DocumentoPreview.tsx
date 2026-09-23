"use client";

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
}: {
  borrador: FacturaBorrador;
  emisor: Emisor | null;
  receptor: Receptor | null;
  pasoActual: PasoId;
  /** Pasos ya visitados: lo demás se ve como hueco. */
  visto: (paso: PasoId) => boolean;
  titulos: Partial<Record<PasoId, string>>;
}) {
  const b = borrador;
  const esPago = b.tipo === "P";
  const totales = calcularTotales(b.conceptos, b.complementos);
  const lleno = (paso: PasoId) => visto(paso) || pasoActual === paso;

  const folio = b.serie && b.folio ? `${b.serie}-${b.folio}` : "—";
  const pago = b.pago;
  const montoPago = parseFloat(pago.monto) || 0;
  const saldoAnt = parseFloat(pago.impSaldoAnt) || 0;

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
        <>
          <Seccion actual={pasoActual} pasos={["pagos"]} etiqueta="Receptor">
            {receptor ? (
              <>
                <p className="font-semibold">{receptor.Nombre}</p>
                <p className="text-ink-2">{receptor.Rfc} · uso CP01 Pagos</p>
              </>
            ) : (
              <Hueco titulo={titulos.pagos ?? "pagos"} />
            )}
          </Seccion>
          <Seccion actual={pasoActual} pasos={["pagos"]} etiqueta="Pago">
            {pago.facturaOrigen ? (
              <div className="space-y-0.5">
                <p>
                  Factura{" "}
                  <span className="font-mono">
                    {pago.facturaOrigen.serie
                      ? `${pago.facturaOrigen.serie}-${pago.facturaOrigen.folio}`
                      : pago.facturaOrigen.folio}
                  </span>{" "}
                  · parcialidad {pago.numParcialidad || "—"}
                </p>
                <p className="text-ink-2">
                  {FORMAS_PAGO.find((f) => f.value === pago.formaDePagoP)?.label ?? "—"} ·{" "}
                  {pago.fechaPago ? pago.fechaPago.replace("T", " ") : "sin fecha"}
                </p>
                <p className="text-ink-2">
                  Saldo {money(saldoAnt, pago.monedaP)} − pago {money(montoPago, pago.monedaP)} = queda{" "}
                  {money(Math.max(saldoAnt - montoPago, 0), pago.monedaP)}
                </p>
              </div>
            ) : (
              <Hueco titulo={titulos.pagos ?? "pagos"} />
            )}
          </Seccion>
          <div className="flex items-baseline justify-end gap-4">
            <span className="text-ink-3">Monto del pago</span>
            <span className="font-mono text-[16px] font-extrabold">{money(montoPago, pago.monedaP)}</span>
          </div>
        </>
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
