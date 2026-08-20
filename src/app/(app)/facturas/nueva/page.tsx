"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Emisor } from "@/lib/emisores";
import type { Serie } from "@/lib/series";
import type { Receptor } from "@/lib/receptores";
import type { ConceptoInput, TimbrarResult } from "@/lib/timbrado";
import { FORMAS_PAGO, METODOS_PAGO, RECEPTOR_PUBLICO_GENERAL, USOS_CFDI } from "@/lib/catalogosSat";
import { ConceptoRow } from "@/components/facturas/ConceptoRow";
import { ReceptorFormModal } from "@/components/receptores/ReceptorFormModal";

const RFC_PUBLICO_GENERAL = RECEPTOR_PUBLICO_GENERAL.Rfc;

const RECEPTOR_PUBLICO_GENERAL_COMO_RECEPTOR: Receptor = {
  Rfc: RECEPTOR_PUBLICO_GENERAL.Rfc,
  Nombre: RECEPTOR_PUBLICO_GENERAL.Nombre,
  RegimenFiscal: RECEPTOR_PUBLICO_GENERAL.RegimenFiscalReceptor,
  DomicilioFiscal: "",
  UsoCfdi: RECEPTOR_PUBLICO_GENERAL.UsoCFDI,
};

const CONCEPTO_VACIO: ConceptoInput = {
  descripcion: "",
  claveProdServ: "",
  claveUnidad: "H87",
  unidad: "Pieza",
  cantidad: 1,
  valorUnitario: 0,
  ivaTasa: "0.160000",
  iepsTasa: "",
  retencionIsrTasa: "",
};

const inputClass =
  "w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none focus:border-neutral-500";

export default function NuevaFacturaPage() {
  const [emisores, setEmisores] = useState<Emisor[]>([]);
  const [rfcEmisor, setRfcEmisor] = useState("");
  const [series, setSeries] = useState<Serie[]>([]);
  const [serieSeleccionada, setSerieSeleccionada] = useState("");
  const [folio, setFolio] = useState<string | null>(null);
  const [formaPago, setFormaPago] = useState("01");
  const [metodoPago, setMetodoPago] = useState("PUE");
  const [condicionesDePago, setCondicionesDePago] = useState("");
  const [receptores, setReceptores] = useState<Receptor[]>([]);
  const [rfcReceptorSeleccionado, setRfcReceptorSeleccionado] = useState(RFC_PUBLICO_GENERAL);
  const [usoCfdiSeleccionado, setUsoCfdiSeleccionado] = useState(RECEPTOR_PUBLICO_GENERAL.UsoCFDI);
  const [modalReceptorAbierto, setModalReceptorAbierto] = useState(false);
  const [conceptos, setConceptos] = useState<ConceptoInput[]>([{ ...CONCEPTO_VACIO }]);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<TimbrarResult | null>(null);

  useEffect(() => {
    fetch("/api/emisores")
      .then((res) => res.json())
      .then((body) => {
        const lista: Emisor[] = body.emisores ?? [];
        setEmisores(lista);
        if (lista.length > 0) setRfcEmisor(lista[0].Rfc);
      });
  }, []);

  const emisor = emisores.find((e) => e.Rfc === rfcEmisor) ?? null;
  const tieneCsdGuardado = Boolean(emisor?.Cert && emisor?.Key);

  useEffect(() => {
    if (!rfcEmisor) return;
    fetch(`/api/empresas/${encodeURIComponent(rfcEmisor)}/series`)
      .then((res) => res.json())
      .then((body) => {
        const todas: Serie[] = body.series ?? [];
        const ingreso = todas.filter((s) => s.Tipo === "I");
        setSeries(ingreso);
        setSerieSeleccionada(ingreso.length > 0 ? ingreso[0].Nombre : "");
      });
  }, [rfcEmisor]);

  useEffect(() => {
    if (!rfcEmisor) return;
    fetch(`/api/empresas/${encodeURIComponent(rfcEmisor)}/receptores`)
      .then((res) => res.json())
      .then((body) => {
        setReceptores(body.receptores ?? []);
        setRfcReceptorSeleccionado(RFC_PUBLICO_GENERAL);
        setUsoCfdiSeleccionado(RECEPTOR_PUBLICO_GENERAL.UsoCFDI);
      });
  }, [rfcEmisor]);

  const receptorSeleccionado =
    rfcReceptorSeleccionado === RFC_PUBLICO_GENERAL
      ? RECEPTOR_PUBLICO_GENERAL_COMO_RECEPTOR
      : (receptores.find((r) => r.Rfc === rfcReceptorSeleccionado) ??
        RECEPTOR_PUBLICO_GENERAL_COMO_RECEPTOR);

  useEffect(() => {
    if (!rfcEmisor || !serieSeleccionada) return;
    const serieInfo = series.find((s) => s.Nombre === serieSeleccionada);
    fetch(
      `/api/facturas/folio?rfc=${encodeURIComponent(rfcEmisor)}&serie=${encodeURIComponent(serieSeleccionada)}`
    )
      .then((res) => res.json())
      .then((body) => {
        const ultimo = body.ultimoFolio ?? 0;
        const siguiente = ultimo > 0 ? ultimo + 1 : parseInt(serieInfo?.Inicio ?? "1", 10) || 1;
        setFolio(String(siguiente));
      });
  }, [rfcEmisor, serieSeleccionada, series]);

  const totales = useMemo(() => {
    let subtotal = 0;
    let impuestos = 0;
    let retenciones = 0;
    for (const c of conceptos) {
      const importe = c.cantidad * c.valorUnitario;
      subtotal += importe;
      if (c.ivaTasa) impuestos += importe * parseFloat(c.ivaTasa);
      if (c.iepsTasa) impuestos += importe * parseFloat(c.iepsTasa);
      if (c.retencionIsrTasa) retenciones += importe * parseFloat(c.retencionIsrTasa);
    }
    return {
      subtotal,
      impuestos,
      retenciones,
      total: subtotal + impuestos - retenciones,
    };
  }, [conceptos]);

  function handleSeleccionarReceptor(rfc: string) {
    setRfcReceptorSeleccionado(rfc);
    const receptor =
      rfc === RFC_PUBLICO_GENERAL
        ? RECEPTOR_PUBLICO_GENERAL_COMO_RECEPTOR
        : receptores.find((r) => r.Rfc === rfc);
    setUsoCfdiSeleccionado(receptor?.UsoCfdi || RECEPTOR_PUBLICO_GENERAL.UsoCFDI);
  }

  function actualizarConcepto(i: number, c: ConceptoInput) {
    setConceptos((prev) => prev.map((prevC, idx) => (idx === i ? c : prevC)));
  }

  function quitarConcepto(i: number) {
    setConceptos((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!emisor || !serieSeleccionada || !folio) {
      setError("Selecciona un emisor y una serie.");
      return;
    }
    if (conceptos.some((c) => !c.descripcion || !c.claveProdServ || c.cantidad <= 0)) {
      setError("Revisa los conceptos: falta descripción, clave de producto/servicio o cantidad.");
      return;
    }

    setEnviando(true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emisorToken: emisor.Token,
          rfcEmisor: emisor.Rfc,
          nombreEmisor: emisor.Nombre,
          regimenEmisor: emisor.Regimen,
          lugarExpedicion: emisor.LugarExp,
          serie: serieSeleccionada,
          folio,
          formaPago,
          metodoPago,
          condicionesDePago: condicionesDePago.trim() || undefined,
          receptorRfc: receptorSeleccionado.Rfc,
          receptorNombre: receptorSeleccionado.Nombre,
          receptorRegimenFiscal: receptorSeleccionado.RegimenFiscal,
          receptorDomicilioFiscal: receptorSeleccionado.DomicilioFiscal,
          receptorUsoCfdi: usoCfdiSeleccionado,
          conceptos,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo timbrar la factura");
        return;
      }

      setResultado(body);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    return (
      <div className="max-w-xl rounded-xl border border-green-200 bg-green-50 p-6 text-center">
        <h1 className="text-lg font-semibold text-green-800">Factura timbrada</h1>
        <p className="mt-2 text-sm text-green-700">UUID: {resultado.UUID}</p>
        <p className="text-sm text-green-700">
          Fecha de timbrado: {resultado.FechaTimbrado}
        </p>
        <Link
          href="/facturas/nueva"
          onClick={() => {
            setResultado(null);
            setConceptos([{ ...CONCEPTO_VACIO }]);
            setCondicionesDePago("");
            handleSeleccionarReceptor(RFC_PUBLICO_GENERAL);
          }}
          className="mt-4 inline-block rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)]"
        >
          Timbrar otra factura
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Nueva factura</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Factura de ingreso, público en general.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Emisor
              </label>
              <select
                className={inputClass}
                value={rfcEmisor}
                onChange={(e) => setRfcEmisor(e.target.value)}
              >
                {emisores.map((e) => (
                  <option key={e.Rfc} value={e.Rfc}>
                    {e.Nombre} ({e.Rfc})
                  </option>
                ))}
              </select>
              {emisor && !tieneCsdGuardado && (
                <p className="mt-1 text-xs text-red-600">
                  Este emisor no tiene certificado cargado.{" "}
                  <Link
                    href={`/emisores/${encodeURIComponent(emisor.Rfc)}`}
                    className="underline"
                  >
                    Súbelo aquí
                  </Link>
                  .
                </p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Serie
              </label>
              {series.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  Este emisor no tiene series de tipo Ingreso.{" "}
                  {emisor && (
                    <Link
                      href={`/emisores/${encodeURIComponent(emisor.Rfc)}`}
                      className="underline"
                    >
                      Crea una
                    </Link>
                  )}
                </p>
              ) : (
                <select
                  className={inputClass}
                  value={serieSeleccionada}
                  onChange={(e) => setSerieSeleccionada(e.target.value)}
                >
                  {series.map((s) => (
                    <option key={s.Nombre} value={s.Nombre}>
                      {s.Nombre}
                    </option>
                  ))}
                </select>
              )}
              {folio && rfcEmisor && serieSeleccionada && (
                <p className="mt-1 text-xs text-neutral-500">Folio: {folio}</p>
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Forma de pago
              </label>
              <select
                className={inputClass}
                value={formaPago}
                onChange={(e) => setFormaPago(e.target.value)}
              >
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Método de pago
              </label>
              <select
                className={inputClass}
                value={metodoPago}
                onChange={(e) => setMetodoPago(e.target.value)}
              >
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Condiciones de pago (opcional)
              </label>
              <input
                className={inputClass}
                placeholder="Ej. Contado, 30 días..."
                value={condicionesDePago}
                onChange={(e) => setCondicionesDePago(e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Receptor</h2>
            <button
              type="button"
              onClick={() => setModalReceptorAbierto(true)}
              className="text-sm font-medium text-[var(--brand)] hover:underline"
            >
              + Nuevo receptor
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">Cliente</label>
              <select
                className={inputClass}
                value={rfcReceptorSeleccionado}
                onChange={(e) => handleSeleccionarReceptor(e.target.value)}
              >
                <option value={RFC_PUBLICO_GENERAL}>Público en general</option>
                {receptores.map((r) => (
                  <option key={r.Rfc} value={r.Rfc}>
                    {r.Nombre} ({r.Rfc})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-neutral-700">
                Uso de CFDI
              </label>
              <select
                className={inputClass}
                value={usoCfdiSeleccionado}
                onChange={(e) => setUsoCfdiSeleccionado(e.target.value)}
              >
                {USOS_CFDI.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-neutral-900">Conceptos</h2>
            <button
              type="button"
              onClick={() => setConceptos([...conceptos, { ...CONCEPTO_VACIO }])}
              className="text-sm font-medium text-[var(--brand)] hover:underline"
            >
              + Agregar concepto
            </button>
          </div>

          {conceptos.map((c, i) => (
            <ConceptoRow
              key={i}
              concepto={c}
              onChange={(nuevo) => actualizarConcepto(i, nuevo)}
              onRemove={() => quitarConcepto(i)}
              puedeEliminar={conceptos.length > 1}
            />
          ))}
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <div className="flex justify-between text-neutral-700">
              <span>Subtotal</span>
              <span>${totales.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-neutral-700">
              <span>Impuestos</span>
              <span>${totales.impuestos.toFixed(2)}</span>
            </div>
            {totales.retenciones > 0 && (
              <div className="flex justify-between text-neutral-700">
                <span>Retenciones</span>
                <span>-${totales.retenciones.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between border-t border-neutral-200 pt-1 font-semibold text-neutral-900">
              <span>Total</span>
              <span>${totales.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={enviando || !tieneCsdGuardado || series.length === 0}
          className="rounded-lg bg-[var(--brand)] px-6 py-2.5 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50"
        >
          {enviando ? "Timbrando..." : "Timbrar factura"}
        </button>
      </form>

      {modalReceptorAbierto && rfcEmisor && (
        <ReceptorFormModal
          rfcEmisor={rfcEmisor}
          onClose={() => setModalReceptorAbierto(false)}
          onSaved={(nuevo) => {
            setModalReceptorAbierto(false);
            setReceptores((prev) => [...prev.filter((r) => r.Rfc !== nuevo.Rfc), nuevo]);
            setRfcReceptorSeleccionado(nuevo.Rfc);
            setUsoCfdiSeleccionado(nuevo.UsoCfdi || RECEPTOR_PUBLICO_GENERAL.UsoCFDI);
          }}
        />
      )}
    </div>
  );
}
