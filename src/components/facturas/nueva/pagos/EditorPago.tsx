"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Field, Input, Note, Select, cx } from "@/components/ui";
import { FORMAS_PAGO, MONEDAS } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import {
  desdeApi,
  dividirPorReceptor,
  equivalenciaDefecto,
  folioDe,
  montoDe,
  pagadoEnFactura,
  problemasDePago,
  round2,
  saldoDisponible,
  sumaImportes,
  toleranciaDe,
  type CapturaPagos,
  type Decision,
  type DoctoCaptura,
  type FacturaPagable,
  type FacturaRelacionadaApi,
  type PagoCaptura,
} from "@/lib/pagosCaptura";
import { SelectorFacturasPago } from "./SelectorFacturasPago";

/*
   Un pago, en dos subpasos (propuesta A del mockup aprobado):
   1. qué facturas cubre, y 2. los datos del pago con cuánto se paga de cada
   una. Nada se reparte solo: se sugiere el saldo de cada factura y el
   usuario lo cambia.
*/

/** El complemento de pago no admite "99 Por definir". */
const FORMAS_PAGO_P = FORMAS_PAGO.filter((f) => f.value !== "99");

function hoyIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nuevoIdPago() {
  return `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

/** Hacia arriba a centavos: así lo pagado nunca queda un centavo corto del saldo. */
function ceil2(n: number) {
  return Math.ceil(Number((n * 100).toFixed(6))) / 100;
}

function importeSugerido(c: CapturaPagos, uuid: string, pagoId: string, equivalencia: number) {
  if (!(equivalencia > 0)) return 0;
  return Math.max(0, ceil2(saldoDisponible(c, uuid, pagoId) / equivalencia));
}

export function EditorPago({
  rfcEmisor,
  captura,
  idPago,
  preseleccion,
  onGuardar,
  onCancelar,
}: {
  rfcEmisor: string;
  captura: CapturaPagos;
  /** null = pago nuevo. */
  idPago: string | null;
  /** Folios fiscales que entran ya elegidos ("Pagar factura" desde el detalle). */
  preseleccion?: string[];
  /** La captura con el pago guardado; `partes` > 1 si se dividió por receptor. */
  onGuardar: (captura: CapturaPagos, partes: number) => void;
  onCancelar: () => void;
}) {
  const base = idPago ? captura.pagos.find((p) => p.id === idPago) : undefined;
  const [sub, setSub] = useState<1 | 2>(base ? 2 : 1);
  const [pago, setPago] = useState<PagoCaptura>(
    () =>
      base ?? {
        id: nuevoIdPago(),
        fecha: hoyIso(),
        hora: "12:00",
        forma: "03",
        moneda: "MXN",
        tipoCambio: 1,
        monto: 0,
        montoManual: false,
        numOperacion: "",
        docs: [],
      }
  );
  const [extra, setExtra] = useState<Record<string, FacturaPagable>>({});
  const [decisiones, setDecisiones] = useState(captura.decisiones);
  /** Importes que el usuario escribió: ya no se recalculan solos. */
  const [tocados, setTocados] = useState<string[]>(base ? base.docs.map((d) => d.uuid) : []);
  const [intento, setIntento] = useState(false);
  const [errorPrecarga, setErrorPrecarga] = useState<string | null>(null);

  const c: CapturaPagos = useMemo(
    () => ({ pagos: captura.pagos, facturas: { ...captura.facturas, ...extra }, decisiones }),
    [captura, extra, decisiones]
  );
  const problemas = problemasDePago(c, { ...pago, monto: montoDe(pago) });

  /** Vuelve a sugerir el importe de las facturas que el usuario no ha tocado. */
  function resugerir(p: PagoCaptura, cc: CapturaPagos, tocadosAhora = tocados): PagoCaptura {
    return {
      ...p,
      // Una factura que aún no está en `cc` (recién elegida en esta misma carga) se deja como está.
      docs: p.docs.map((d) =>
        tocadosAhora.includes(d.uuid) || !cc.facturas[d.uuid]
          ? d
          : { ...d, importe: importeSugerido(cc, d.uuid, p.id, d.equivalencia) }
      ),
    };
  }

  function elegir(f: FacturaPagable) {
    setExtra((prev) => ({ ...prev, [f.uuid]: f }));
    setPago((prev) => {
      if (prev.docs.some((d) => d.uuid === f.uuid)) return prev;
      const cc = { ...c, facturas: { ...c.facturas, [f.uuid]: f } };
      const equivalencia = equivalenciaDefecto(prev.moneda, prev.tipoCambio, f.moneda);
      const doc: DoctoCaptura = {
        uuid: f.uuid,
        equivalencia,
        importe: importeSugerido(cc, f.uuid, prev.id, equivalencia),
      };
      return { ...prev, docs: [...prev.docs, doc] };
    });
  }

  function quitar(uuid: string) {
    setPago((prev) => ({ ...prev, docs: prev.docs.filter((d) => d.uuid !== uuid) }));
    setTocados((prev) => prev.filter((u) => u !== uuid));
  }

  function actualizar(cambios: Array<{ f: FacturaPagable; decision?: Decision }>) {
    const nuevas = Object.fromEntries(cambios.map(({ f }) => [f.uuid, f]));
    const decs = { ...decisiones };
    for (const { f, decision } of cambios) if (decision) decs[f.uuid] = decision;
    setExtra((prev) => ({ ...prev, ...nuevas }));
    setDecisiones(decs);
    setPago((prev) => resugerir(prev, { ...c, facturas: { ...c.facturas, ...nuevas }, decisiones: decs }));
  }

  function decidir(uuid: string, d: Decision) {
    const decs = { ...decisiones, [uuid]: d };
    setDecisiones(decs);
    setPago((prev) => resugerir(prev, { ...c, decisiones: decs }));
  }

  /** Moneda o tipo de cambio: cambian las equivalencias y, con ellas, lo sugerido. */
  function cambiarMoneda(moneda: string, tipoCambio: number) {
    setPago((prev) => {
      const docs = prev.docs.map((d) => {
        const f = c.facturas[d.uuid];
        if (!f) return d;
        const def = equivalenciaDefecto(moneda, tipoCambio, f.moneda);
        const equivalencia = def > 0 ? def : f.moneda === prev.moneda ? 0 : d.equivalencia;
        return { ...d, equivalencia };
      });
      return resugerir({ ...prev, moneda, tipoCambio: moneda === "MXN" ? 1 : tipoCambio, docs }, c);
    });
  }

  function cambiarDoc(uuid: string, cambios: Partial<DoctoCaptura>) {
    const tocadosAhora = "importe" in cambios && !tocados.includes(uuid) ? [...tocados, uuid] : tocados;
    if (tocadosAhora !== tocados) setTocados(tocadosAhora);
    setPago((prev) => {
      const docs = prev.docs.map((d) => (d.uuid === uuid ? { ...d, ...cambios } : d));
      return "equivalencia" in cambios ? resugerir({ ...prev, docs }, c, tocadosAhora) : { ...prev, docs };
    });
  }

  // "Pagar factura" desde el detalle: la factura entra ya elegida.
  const precargado = useRef(false);
  useEffect(() => {
    if (precargado.current || !preseleccion?.length || !rfcEmisor) return;
    precargado.current = true;
    fetch("/api/facturas/pagos-relacionados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfcEmisor, uuids: preseleccion }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No se pudo consultar la factura");
        const fs = (body.facturas as FacturaRelacionadaApi[]).map(desdeApi);
        if (fs.some((f) => f === null)) setErrorPrecarga("No se encontró la factura entre las de este emisor.");
        fs.forEach((f) => f && elegir(f));
      })
      .catch((e: unknown) => setErrorPrecarga(e instanceof Error ? e.message : "No se pudo consultar la factura"));
    // elegir usa el estado más reciente vía setState funcional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preseleccion, rfcEmisor]);

  function guardar() {
    setIntento(true);
    if (problemas.errores.length > 0) return;
    const final: PagoCaptura = { ...pago, monto: montoDe(pago) };
    const partes = dividirPorReceptor(c, final, nuevoIdPago);
    const pagos = [...captura.pagos.filter((p) => p.id !== final.id), ...partes];
    const usadas = new Set(pagos.flatMap((p) => p.docs.map((d) => d.uuid)));
    const facturas = Object.fromEntries(Object.entries(c.facturas).filter(([u]) => usadas.has(u)));
    onGuardar({ pagos, facturas, decisiones }, partes.length);
  }

  const suma = sumaImportes(pago);

  return (
    <section
      aria-label={idPago ? "Editar pago" : "Nuevo pago"}
      className="overflow-hidden rounded-xl border-[1.5px] border-brand bg-surface shadow-[0_0_0_4px_var(--brand-050)]"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-2 px-4 py-3">
        <h2 className="text-[15px] font-bold text-ink">{idPago ? "Editar pago" : "Nuevo pago"}</h2>
        <ol className="flex flex-wrap gap-1.5 text-[12px] font-semibold">
          <Subpaso n={1} actual={sub === 1} hecho={sub === 2} onClick={() => setSub(1)}>
            Facturas que cubre
          </Subpaso>
          <Subpaso n={2} actual={sub === 2} hecho={false} onClick={() => pago.docs.length > 0 && setSub(2)}>
            Datos del pago
          </Subpaso>
        </ol>
      </header>

      <div className="space-y-4 p-3 sm:p-4">
        {errorPrecarga && <Note tone="danger">{errorPrecarga}</Note>}

        {sub === 1 ? (
          <SelectorFacturasPago
            rfcEmisor={rfcEmisor}
            c={c}
            pago={pago}
            onElegir={elegir}
            onQuitar={quitar}
            onActualizar={actualizar}
            onDecision={decidir}
          />
        ) : (
          <>
            <DatosPago pago={pago} setPago={setPago} onMoneda={cambiarMoneda} suma={suma} />
            <div className="space-y-2">
              <h3 className="text-[13.5px] font-semibold text-ink">Cuánto pagas de cada factura</h3>
              <Importes c={c} pago={pago} onCambiar={cambiarDoc} onQuitar={quitar} />
            </div>
          </>
        )}

        {sub === 2 && intento && problemas.errores.length > 0 && (
          <Note tone="danger" title="Falta para guardar el pago">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {problemas.errores.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Note>
        )}
        {problemas.avisos.map((a) => (
          <Note key={a} tone="warn">
            {a}
          </Note>
        ))}
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-2 px-4 py-3">
        {sub === 1 ? (
          <>
            <Button variant="ghost" onClick={onCancelar}>
              Cancelar
            </Button>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[12.5px] text-ink-3">
                {pago.docs.length} factura{pago.docs.length === 1 ? "" : "s"} · {money(suma, pago.moneda)}
              </span>
              <Button variant="primary" onClick={() => setSub(2)} disabled={pago.docs.length === 0}>
                Siguiente: datos del pago
              </Button>
            </div>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={() => setSub(1)}>
              Atrás: facturas
            </Button>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="ghost" onClick={onCancelar}>
                Cancelar
              </Button>
              <Button variant="primary" onClick={guardar}>
                Guardar pago
              </Button>
            </div>
          </>
        )}
      </footer>
    </section>
  );
}

function Subpaso({
  n,
  actual,
  hecho,
  onClick,
  children,
}: {
  n: number;
  actual: boolean;
  hecho: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-current={actual ? "step" : undefined}
        className={cx(
          "focus-brand inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 transition",
          actual
            ? "border-brand bg-brand text-brand-ink"
            : hecho
              ? "border-ok/40 bg-ok-bg text-ok"
              : "border-line bg-surface text-ink-3"
        )}
      >
        <span aria-hidden>{hecho ? "✓" : n}</span>
        {children}
      </button>
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Datos del pago                                                             */
/* -------------------------------------------------------------------------- */

function DatosPago({
  pago,
  setPago,
  onMoneda,
  suma,
}: {
  pago: PagoCaptura;
  setPago: React.Dispatch<React.SetStateAction<PagoCaptura>>;
  onMoneda: (moneda: string, tipoCambio: number) => void;
  suma: number;
}) {
  const set = (cambios: Partial<PagoCaptura>) => setPago((prev) => ({ ...prev, ...cambios }));
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field
          label="Monto recibido"
          hint={
            pago.montoManual ? (
              <>
                Lo escribiste tú.{" "}
                <button
                  type="button"
                  onClick={() => set({ montoManual: false, monto: suma })}
                  className="focus-brand rounded font-semibold text-brand underline"
                >
                  Usar la suma de las facturas
                </button>
              </>
            ) : (
              "Es la suma de las facturas. Cámbialo si recibiste otra cantidad."
            )
          }
        >
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            className="text-right font-mono"
            value={pago.montoManual ? pago.monto || "" : suma.toFixed(2)}
            onChange={(e) => set({ montoManual: true, monto: parseFloat(e.target.value) || 0 })}
          />
        </Field>
        <Field label="Fecha de pago">
          <Input type="date" value={pago.fecha} onChange={(e) => set({ fecha: e.target.value })} />
        </Field>
        <Field label="Hora">
          <Input type="time" value={pago.hora} onChange={(e) => set({ hora: e.target.value })} />
        </Field>
        <Field label="Forma de pago">
          <Select value={pago.forma} onChange={(e) => set({ forma: e.target.value })}>
            {FORMAS_PAGO_P.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Moneda">
          <Select value={pago.moneda} onChange={(e) => onMoneda(e.target.value, e.target.value === "MXN" ? 1 : 0)}>
            {MONEDAS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo de cambio" hint={pago.moneda === "MXN" ? "Pesos: siempre 1." : "Pesos por cada unidad del pago."}>
          <Input
            type="number"
            min={0}
            step="0.000001"
            inputMode="decimal"
            className="text-right font-mono"
            disabled={pago.moneda === "MXN"}
            value={pago.moneda === "MXN" ? "1" : pago.tipoCambio || ""}
            onChange={(e) => onMoneda(pago.moneda, parseFloat(e.target.value) || 0)}
          />
        </Field>
      </div>
      <details className="group">
        <summary className="focus-brand cursor-pointer rounded text-[12.5px] font-semibold text-ink-3 hover:text-ink">
          Datos bancarios (opcionales)
        </summary>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Field label="Número de operación" hint="Folio de la transferencia o número del cheque.">
            <Input
              value={pago.numOperacion}
              maxLength={100}
              onChange={(e) => set({ numOperacion: e.target.value })}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Importe de cada factura                                                    */
/* -------------------------------------------------------------------------- */

function Importes({
  c,
  pago,
  onCambiar,
  onQuitar,
}: {
  c: CapturaPagos;
  pago: PagoCaptura;
  onCambiar: (uuid: string, cambios: Partial<DoctoCaptura>) => void;
  onQuitar: (uuid: string) => void;
}) {
  if (pago.docs.length === 0) {
    return <Note tone="info">Todavía no eliges facturas para este pago.</Note>;
  }
  const otraMoneda = pago.docs.some((d) => c.facturas[d.uuid]?.moneda !== pago.moneda);
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-left text-[13px] sm:min-w-[620px]">
        <thead>
          <tr className="bg-surface-2 text-[11.5px] text-ink-3">
            <th className="px-2 py-2 sm:px-3 font-semibold">Factura</th>
            <th className="hidden px-2 py-2 text-right font-semibold sm:table-cell sm:px-3">Le queda</th>
            {otraMoneda && <th className="px-2 py-2 sm:px-3 text-right font-semibold">Equivalencia</th>}
            <th className="px-2 py-2 sm:px-3 text-right font-semibold">Pagas ({pago.moneda})</th>
            <th className="hidden px-3 py-2 text-right font-semibold sm:table-cell">Queda después</th>
            <th className="px-2 py-2 sm:px-3">
              <span className="sr-only">Quitar</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {pago.docs.map((d) => {
            const f = c.facturas[d.uuid];
            if (!f) return null;
            const disp = saldoDisponible(c, d.uuid, pago.id);
            const bruto = pagadoEnFactura(d);
            // Unos centavos de más por la equivalencia se ajustan al saldo, igual que en la cadena.
            const pagado = bruto > disp && bruto - disp <= toleranciaDe(d) ? disp : bruto;
            const queda = round2(disp - pagado);
            const mal = queda < -toleranciaDe(d);
            return (
              <tr key={d.uuid} className="border-t border-line-2 align-top">
                <td className="px-2 py-2.5 sm:px-3">
                  <span className="font-mono font-semibold text-ink">{folioDe(f)}</span>
                  <span className="block max-w-[120px] truncate text-[12px] text-ink-3 sm:max-w-[220px]">{f.receptor.nombre}</span>
                  {/* En teléfono, lo que le queda va aquí: su columna se oculta. */}
                  <span className="block font-mono text-[12px] text-ink-2 sm:hidden">le quedan {money(disp, f.moneda)}</span>
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 text-right font-mono text-ink-2 sm:table-cell sm:px-3">{money(disp, f.moneda)}</td>
                {otraMoneda && (
                  <td className="px-2 py-2.5 sm:px-3 text-right">
                    {f.moneda === pago.moneda ? (
                      <span className="font-mono text-ink-3">1</span>
                    ) : (
                      <>
                        <input
                          type="number"
                          min={0}
                          step="0.000001"
                          inputMode="decimal"
                          value={d.equivalencia || ""}
                          onChange={(e) => onCambiar(d.uuid, { equivalencia: parseFloat(e.target.value) || 0 })}
                          aria-label={`Equivalencia de ${folioDe(f)}`}
                          className="focus-brand w-24 rounded-lg sm:w-28 border border-line bg-surface px-2 py-1 text-right font-mono text-[13px] text-ink focus:border-brand"
                        />
                        <span className="block text-[11px] text-ink-4">
                          {f.moneda} por 1 {pago.moneda}
                        </span>
                      </>
                    )}
                  </td>
                )}
                <td className="px-2 py-2.5 sm:px-3 text-right">
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    inputMode="decimal"
                    value={d.importe || ""}
                    onChange={(e) => onCambiar(d.uuid, { importe: parseFloat(e.target.value) || 0 })}
                    aria-label={`Importe de ${folioDe(f)}`}
                    aria-invalid={mal}
                    className={cx(
                      "focus-brand w-[84px] rounded-lg sm:w-32 border bg-surface px-2 py-1 text-right font-mono text-[13px] text-ink focus:border-brand",
                      mal ? "border-danger" : "border-line"
                    )}
                  />
                  {f.moneda !== pago.moneda && (
                    <span className="block text-[11px] text-ink-4">= {money(pagado, f.moneda)}</span>
                  )}
                </td>
                <td
                  className={cx(
                    "hidden whitespace-nowrap px-2 py-2.5 sm:px-3 text-right font-mono sm:table-cell",
                    mal ? "text-danger" : "text-ink-2"
                  )}
                >
                  {money(mal ? queda : Math.max(queda, 0), f.moneda)}
                </td>
                <td className="py-2.5 pl-1 pr-2 text-right sm:px-3">
                  <button
                    type="button"
                    onClick={() => onQuitar(d.uuid)}
                    aria-label={`Quitar ${folioDe(f)} de este pago`}
                    className="focus-brand rounded text-[12.5px] font-semibold text-ink-3 hover:text-danger sm:underline"
                  >
                    {/* En teléfono, una ✕ para que la tabla quepa sin desplazarse. */}
                    <span aria-hidden className="text-[15px] sm:hidden">✕</span>
                    <span aria-hidden className="hidden sm:inline">Quitar</span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-surface-2">
            {/* Abarca las columnas antes de "Pagas"; en teléfono "Le queda" no se ve, así que es una menos. */}
            <td colSpan={otraMoneda ? 3 : 2} className="hidden px-3 py-2 text-right text-[12.5px] font-semibold text-ink sm:table-cell">
              Suma de las facturas
            </td>
            <td colSpan={otraMoneda ? 2 : 1} className="px-2 py-2 text-right text-[12.5px] font-semibold text-ink sm:hidden">
              Suma
            </td>
            <td className="whitespace-nowrap px-3 py-2 text-right font-mono font-bold text-ink">
              {money(sumaImportes(pago), pago.moneda)}
            </td>
            <td colSpan={2} className="hidden sm:table-cell" />
            <td className="sm:hidden" />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
