"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Note, Pill, SearchInput, Segmented, cx } from "@/components/ui";
import { money, parseCfdi, type Cfdi } from "@/lib/cfdi";
import {
  desdeApi,
  desdeXml,
  folioDe,
  inicio,
  pagoPosteriorEnFactubox,
  receptoresDe,
  revisarComplementoPrevio,
  saldoDisponible,
  ultimaParcialidadEn,
  type CapturaPagos,
  type Decision,
  type FacturaPagable,
  type FacturaRelacionadaApi,
  type PagoCaptura,
  type PorPagar,
} from "@/lib/pagosCaptura";

/*
   Primer subpaso del pago: qué facturas cubre. Salen de Factubox (PPD
   vigentes con saldo) o de XML que el usuario suelta. En cada renglón se
   decide cómo sigue una factura que ya tenía pagos.
*/

/** El endpoint acepta hasta 100 folios fiscales por llamada. */
const MAX_DETALLES = 100;

async function traerRelacionadas(rfcEmisor: string, uuids: string[]): Promise<FacturaRelacionadaApi[]> {
  if (uuids.length === 0) return [];
  const res = await fetch("/api/facturas/pagos-relacionados", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rfcEmisor, uuids }),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? "No se pudo consultar las facturas");
  return body.facturas as FacturaRelacionadaApi[];
}

/*
   El servidor PHP abre un grupo de ~20 procesos por cada petición que le llega
   al mismo tiempo que otra, y no los suelta en horas; el servidor compartido ya
   se quedó sin memoria por eso. De ahí los dos ahorros de abajo.
*/

/**
 * Las facturas que se marcan seguidas se piden juntas: esperar un momento y
 * mandar una sola llamada, en vez de una por clic que se enciman.
 */
const LOTE_MS = 150;
type Espera = { resolve: (f: FacturaRelacionadaApi | undefined) => void; reject: (e: unknown) => void };
let lote: { rfcEmisor: string; esperas: Map<string, Espera[]>; timer: ReturnType<typeof setTimeout> } | null = null;

function soltarLote() {
  if (!lote) return;
  const { rfcEmisor, esperas, timer } = lote;
  clearTimeout(timer);
  lote = null;
  traerRelacionadas(rfcEmisor, [...esperas.keys()]).then(
    (lista) => {
      const porUuid = new Map(lista.map((f) => [f.Uuid.toUpperCase(), f]));
      for (const [uuid, es] of esperas) for (const e of es) e.resolve(porUuid.get(uuid.toUpperCase()));
    },
    (err) => {
      for (const es of esperas.values()) for (const e of es) e.reject(err);
    }
  );
}

function pedirRelacionada(rfcEmisor: string, uuid: string): Promise<FacturaRelacionadaApi | undefined> {
  if (lote && lote.rfcEmisor !== rfcEmisor) soltarLote();
  if (!lote) lote = { rfcEmisor, esperas: new Map(), timer: setTimeout(soltarLote, LOTE_MS) };
  const actual = lote;
  return new Promise((resolve, reject) => {
    actual.esperas.set(uuid, [...(actual.esperas.get(uuid) ?? []), { resolve, reject }]);
    if (actual.esperas.size >= MAX_DETALLES) soltarLote();
  });
}

/**
 * Las facturas por pagar de cada emisor, para no volver a pedirlas cada vez
 * que se abre otro pago de la captura. Caducan solas en unos minutos (se pudo
 * timbrar en otra pestaña) y se olvidan al timbrar, que cambia los saldos.
 */
const POR_PAGAR_VIGENCIA_MS = 2 * 60 * 1000;
const porPagarCache = new Map<string, { hasta: number; datos: Promise<PorPagar> }>();

export function olvidarPorPagar() {
  porPagarCache.clear();
}

function pedirPorPagar(rfcEmisor: string): Promise<PorPagar> {
  const guardado = porPagarCache.get(rfcEmisor);
  if (guardado && guardado.hasta > Date.now()) return guardado.datos;
  const datos = fetch(`/api/facturas/por-pagar?rfcEmisor=${encodeURIComponent(rfcEmisor)}`).then(async (res) => {
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "No se pudieron consultar las facturas por pagar");
    return body as PorPagar;
  });
  porPagarCache.set(rfcEmisor, { hasta: Date.now() + POR_PAGAR_VIGENCIA_MS, datos });
  // Un error no se guarda: el siguiente intento vuelve a preguntar.
  datos.catch(() => {
    if (porPagarCache.get(rfcEmisor)?.datos === datos) porPagarCache.delete(rfcEmisor);
  });
  return datos;
}

type RenglonXml = {
  archivo: string;
  folio: string;
  receptor: string;
  tono: "ok" | "info" | "danger";
  texto: string;
};

export function SelectorFacturasPago({
  rfcEmisor,
  c,
  pago,
  onElegir,
  onQuitar,
  onActualizar,
  onDecision,
}: {
  rfcEmisor: string;
  /** La captura con lo que el editor ya cargó. */
  c: CapturaPagos;
  pago: PagoCaptura;
  /** Agrega la factura a las conocidas y la elige para este pago. */
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  /** Cambia los datos de una factura ya conocida (p. ej. su complemento anterior). */
  onActualizar: (cambios: Array<{ f: FacturaPagable; decision?: Decision }>) => void;
  onDecision: (uuid: string, d: Decision) => void;
}) {
  const [tab, setTab] = useState<"factubox" | "xml">("factubox");
  const elegidas = pago.docs.map((d) => d.uuid);
  const receptorEd = receptoresDe(c, elegidas)[0] ?? null;
  const nombreReceptorEd = receptorEd ? (c.facturas[elegidas[0]]?.receptor.nombre ?? receptorEd) : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<"factubox" | "xml">
          ariaLabel="De dónde salen las facturas"
          value={tab}
          onChange={setTab}
          options={[
            { value: "factubox", label: "De Factubox" },
            { value: "xml", label: "Desde XML" },
          ]}
        />
        <span className="text-[12.5px] text-ink-3">
          {elegidas.length} elegida{elegidas.length === 1 ? "" : "s"}
        </span>
      </div>

      {tab === "factubox" ? (
        <DeFactubox
          rfcEmisor={rfcEmisor}
          c={c}
          pago={pago}
          receptorEd={receptorEd}
          nombreReceptorEd={nombreReceptorEd}
          onElegir={onElegir}
          onQuitar={onQuitar}
          onDecision={onDecision}
          onActualizar={onActualizar}
        />
      ) : (
        <DesdeXml
          rfcEmisor={rfcEmisor}
          c={c}
          pago={pago}
          onElegir={onElegir}
          onQuitar={onQuitar}
          onActualizar={onActualizar}
          onDecision={onDecision}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* De Factubox                                                                */
/* -------------------------------------------------------------------------- */

/** Lo que trae la lista de por pagar, para pintar el renglón antes del detalle. */
function provisional(f: PorPagar["Facturas"][number], receptor: { rfc: string; nombre: string }): FacturaPagable {
  return {
    uuid: f.Uuid,
    serie: f.Serie,
    folio: f.Folio,
    fecha: f.Fecha.slice(0, 10),
    total: parseFloat(f.Total) || 0,
    moneda: f.Moneda || "MXN",
    receptor: { rfc: receptor.rfc, nombre: receptor.nombre, regimen: "", cp: "" },
    origen: "factubox",
    traslados: [],
    retenciones: [],
    previos: [],
    complementoPrevio: null,
  };
}

/** "$56,000.00 · 860.00 USD": un saldo por moneda, sin sumarlas. */
function saldos(s: Record<string, string>) {
  return Object.entries(s)
    .map(([m, v]) => money(v, m))
    .join(" · ");
}

/*
   "De Factubox", primero el receptor: con cientos de facturas PPD de un solo
   receptor (Público en general de un lote), una lista por fecha enterraba las
   facturas madre. Se elige de quién es el pago y solo salen las suyas. Todo el
   historial, con el saldo ya calculado en el servidor.
*/
function DeFactubox({
  rfcEmisor,
  c,
  pago,
  receptorEd,
  onElegir,
  onQuitar,
  onDecision,
  onActualizar,
}: {
  rfcEmisor: string;
  c: CapturaPagos;
  pago: PagoCaptura;
  receptorEd: string | null;
  nombreReceptorEd: string | null;
  onActualizar: (cambios: Array<{ f: FacturaPagable; decision?: Decision }>) => void;
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  onDecision: (uuid: string, d: Decision) => void;
}) {
  // Cacheado con la clave que lo produjo (ver RelacionarFacturaModal): así
  // "cargando" se deriva sin setState dentro del efecto.
  const [cache, setCache] = useState<{ clave: string; datos: PorPagar | null; error: string | null } | null>(null);
  const vigente = cache?.clave === rfcEmisor ? cache : null;

  /** El receptor que se está viendo. Sin elegir, se sigue al del pago. */
  const [elegido, setElegido] = useState<string | null>(null);
  const [cambiando, setCambiando] = useState(false);
  const receptor = cambiando ? null : (elegido ?? receptorEd);
  const [qReceptor, setQReceptor] = useState("");
  const [qFactura, setQFactura] = useState("");
  /** Folios fiscales cuyo detalle (impuestos, historial) se está trayendo. */
  const [trayendo, setTrayendo] = useState<string[]>([]);
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);

  useEffect(() => {
    if (!rfcEmisor) return;
    let vivo = true;
    pedirPorPagar(rfcEmisor)
      .then((datos) => vivo && setCache({ clave: rfcEmisor, datos, error: null }))
      .catch((e: unknown) => {
        if (!vivo) return;
        setCache({ clave: rfcEmisor, datos: null, error: e instanceof Error ? e.message : "No se pudo consultar" });
      });
    return () => {
      vivo = false;
    };
  }, [rfcEmisor]);

  const datos = vigente?.datos ?? null;
  const infoReceptor = datos?.Receptores.find((r) => r.Rfc === receptor) ?? null;

  const receptoresVista = useMemo(() => {
    const q = qReceptor.trim().toLowerCase();
    return (datos?.Receptores ?? []).filter((r) => !q || `${r.Nombre} ${r.Rfc}`.toLowerCase().includes(q));
  }, [datos, qReceptor]);

  const filas = useMemo(() => {
    if (!receptor) return [];
    const q = qFactura.trim().toLowerCase();
    const nombre = infoReceptor?.Nombre ?? c.facturas[pago.docs[0]?.uuid]?.receptor.nombre ?? receptor;
    const res: Array<{ f: FacturaPagable; disp: number | null }> = [];
    // Las ya elegidas primero, aunque sean de otro receptor.
    for (const d of pago.docs) {
      const f = c.facturas[d.uuid];
      if (f) res.push({ f, disp: saldoDisponible(c, d.uuid, pago.id) });
    }
    for (const lf of datos?.Facturas ?? []) {
      if (lf.RfcReceptor !== receptor || pago.docs.some((d) => d.uuid === lf.Uuid)) continue;
      if (q && !`${lf.Serie}-${lf.Folio} ${lf.Total} ${lf.Saldo} ${lf.Uuid}`.toLowerCase().includes(q)) continue;
      const conocida = c.facturas[lf.Uuid];
      if (trayendo.includes(lf.Uuid)) {
        res.push({ f: conocida ?? provisional(lf, { rfc: receptor, nombre }), disp: null });
        continue;
      }
      // Lo que ya se usó en otros pagos de esta captura también cuenta.
      const disp = conocida ? saldoDisponible(c, lf.Uuid, pago.id) : parseFloat(lf.Saldo) || 0;
      if (disp <= 0.004) continue;
      res.push({ f: conocida ?? provisional(lf, { rfc: receptor, nombre }), disp });
    }
    return res;
  }, [receptor, qFactura, infoReceptor, c, pago, datos, trayendo]);

  /** Al marcarla se traen sus impuestos y su historial; luego queda elegida. */
  async function elegir(f: FacturaPagable) {
    if (c.facturas[f.uuid]) {
      onElegir(c.facturas[f.uuid]);
      return;
    }
    setErrorDetalle(null);
    setTrayendo((prev) => [...prev, f.uuid]);
    try {
      const api = await pedirRelacionada(rfcEmisor, f.uuid);
      const completa = api ? desdeApi(api) : null;
      if (!completa) throw new Error(`No se encontró ${folioDe(f)} entre las facturas de este emisor.`);
      onElegir(completa);
    } catch (e) {
      setErrorDetalle(e instanceof Error ? e.message : "No se pudo consultar la factura");
    } finally {
      setTrayendo((prev) => prev.filter((u) => u !== f.uuid));
    }
  }

  if (vigente?.error) return <Note tone="danger">{vigente.error}</Note>;
  if (!datos) {
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-3">
        Buscando facturas PPD con saldo…
      </p>
    );
  }

  /* ---------- ¿De quién es el pago? ---------- */
  if (!receptor) {
    return (
      <div className="space-y-3">
        <p className="text-[13.5px] font-semibold text-ink">¿De quién es el pago?</p>
        <SearchInput
          placeholder="Buscar receptor por nombre o RFC"
          value={qReceptor}
          onChange={(e) => setQReceptor(e.target.value)}
          aria-label="Buscar receptor"
        />
        {receptoresVista.length === 0 ? (
          <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-3">
            {datos.Receptores.length === 0
              ? "Este emisor no tiene facturas PPD con saldo pendiente."
              : "Ningún receptor coincide con la búsqueda."}
          </p>
        ) : (
          <ul className="divide-y divide-line-2 overflow-hidden rounded-xl border border-line bg-surface">
            {receptoresVista.map((r) => (
              <li key={r.Rfc}>
                <button
                  type="button"
                  onClick={() => {
                    setElegido(r.Rfc);
                    setCambiando(false);
                    setQFactura("");
                  }}
                  className="focus-brand flex w-full flex-wrap items-baseline gap-x-3 gap-y-0.5 px-3.5 py-2.5 text-left transition hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold text-ink">{r.Nombre}</span>
                    <span className="font-mono text-[11.5px] text-ink-4">{r.Rfc}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-mono text-[13px] font-semibold text-ink">{saldos(r.Saldos)}</span>
                    <span className="text-[11.5px] text-ink-3">
                      {r.Facturas} factura{r.Facturas === 1 ? "" : "s"} con saldo
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  /* ---------- Las facturas del receptor ---------- */
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-surface-2 px-3.5 py-2.5">
        <span className="min-w-0">
          <span className="block truncate text-[13.5px] font-semibold text-ink">
            {infoReceptor?.Nombre ?? c.facturas[pago.docs[0]?.uuid]?.receptor.nombre ?? receptor}
          </span>
          <span className="text-[12px] text-ink-3">
            {infoReceptor
              ? `${infoReceptor.Facturas} factura${infoReceptor.Facturas === 1 ? "" : "s"} con saldo · ${saldos(infoReceptor.Saldos)}`
              : receptor}
          </span>
        </span>
        <button
          type="button"
          onClick={() => {
            setCambiando(true);
            setQReceptor("");
          }}
          className="focus-brand rounded text-[12.5px] font-semibold text-brand underline"
        >
          Cambiar receptor
        </button>
      </div>
      {receptorEd && receptor !== receptorEd && (
        <Note tone="warn">
          Este pago ya tiene facturas de otro receptor. Si agregas de este, al guardarlo se dividirá en un pago por
          receptor, y cada uno irá en su propio complemento.
        </Note>
      )}
      <SearchInput
        placeholder="Buscar por folio o importe"
        value={qFactura}
        onChange={(e) => setQFactura(e.target.value)}
        aria-label="Buscar factura"
      />
      {errorDetalle && <Note tone="danger">{errorDetalle}</Note>}
      <TablaFacturas
        rfcEmisor={rfcEmisor}
        filas={filas}
        c={c}
        pago={pago}
        receptorEd={receptorEd}
        vacio="Este receptor no tiene facturas PPD con saldo que coincidan."
        onElegir={elegir}
        onQuitar={onQuitar}
        onDecision={onDecision}
        onActualizar={onActualizar}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Desde XML                                                                  */
/* -------------------------------------------------------------------------- */

function leerTexto(file: File) {
  return new Promise<string>((ok, mal) => {
    const rd = new FileReader();
    rd.onload = () => ok(String(rd.result ?? ""));
    rd.onerror = () => mal(rd.error);
    rd.readAsText(file);
  });
}

function DesdeXml({
  rfcEmisor,
  c,
  pago,
  onElegir,
  onQuitar,
  onActualizar,
  onDecision,
}: {
  rfcEmisor: string;
  c: CapturaPagos;
  pago: PagoCaptura;
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  onActualizar: (cambios: Array<{ f: FacturaPagable; decision?: Decision }>) => void;
  onDecision: (uuid: string, d: Decision) => void;
}) {
  const [renglones, setRenglones] = useState<RenglonXml[]>([]);
  const [leyendo, setLeyendo] = useState(false);
  const [encima, setEncima] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function cargar(files: File[]) {
    if (files.length === 0) return;
    setLeyendo(true);
    const nuevos: RenglonXml[] = [];
    try {
      const leidos: Array<{ archivo: string; cfdi: Cfdi | null }> = [];
      for (const file of files) {
        try {
          leidos.push({ archivo: file.name, cfdi: parseCfdi(await leerTexto(file)) });
        } catch {
          leidos.push({ archivo: file.name, cfdi: null });
        }
      }

      // Primero las facturas; los complementos se aplican después sobre ellas.
      const listas: FacturaPagable[] = [];
      const vistos = new Set(pago.docs.map((d) => d.uuid));
      for (const { archivo, cfdi } of leidos) {
        if (!cfdi || !cfdi.tipoDeComprobante) {
          nuevos.push({ archivo, folio: "—", receptor: "", tono: "danger", texto: "No es un CFDI" });
          continue;
        }
        if (cfdi.tipoDeComprobante === "P") continue;
        const r = desdeXml(cfdi, archivo, rfcEmisor);
        const folio = [cfdi.serie, cfdi.folio].filter(Boolean).join("-") || "s/f";
        if (r.estado === "rechazada") {
          nuevos.push({ archivo, folio, receptor: cfdi.receptor.nombre, tono: "danger", texto: r.motivo });
          continue;
        }
        if (vistos.has(r.factura.uuid)) {
          nuevos.push({ archivo, folio, receptor: cfdi.receptor.nombre, tono: "info", texto: "Ya está en este pago" });
          continue;
        }
        vistos.add(r.factura.uuid);
        listas.push(r.factura);
      }

      // Si ya está en Factubox, manda su historial de pagos.
      let enFactubox: FacturaPagable[] = [];
      try {
        enFactubox = (await traerRelacionadas(rfcEmisor, listas.map((f) => f.uuid).slice(0, MAX_DETALLES)))
          .map(desdeApi)
          .filter((f): f is FacturaPagable => f !== null);
      } catch {
        // Sin conexión con el historial: se usan los datos del XML tal cual.
      }
      // Las nuevas de esta carga se eligen al final, ya con su complemento
      // anterior; las de cargas previas se actualizan juntas en una sola llamada.
      const nuevas = new Map<string, FacturaPagable>();
      for (const f of listas) {
        const sis = enFactubox.find((x) => x.uuid === f.uuid);
        nuevas.set(f.uuid, sis ?? c.facturas[f.uuid] ?? f);
        nuevos.push({
          archivo: f.archivo ?? "",
          folio: folioDe(f),
          receptor: f.receptor.nombre,
          tono: sis ? "info" : "ok",
          texto: sis ? "Ya está en Factubox: se usa su historial" : "Lista",
        });
      }
      const previas = new Map<string, FacturaPagable>(
        Object.values(c.facturas)
          .filter((f) => f.origen === "xml" && !nuevas.has(f.uuid))
          .map((f) => [f.uuid, f])
      );

      // Complementos anteriores: dicen desde qué parcialidad sigue cada factura de fuera.
      for (const { archivo, cfdi } of leidos) {
        if (!cfdi || cfdi.tipoDeComprobante !== "P") continue;
        if (cfdi.emisor.rfc.toUpperCase() !== rfcEmisor.toUpperCase()) {
          nuevos.push({ archivo, folio: "", receptor: cfdi.receptor.nombre, tono: "danger", texto: "Complemento de otro emisor" });
          continue;
        }
        const aplicadas: string[] = [];
        for (const mapa of [nuevas, previas]) {
          for (const f of mapa.values()) {
            if (f.origen !== "xml") continue;
            const u = ultimaParcialidadEn(cfdi, f.uuid, archivo);
            if (!u) continue;
            if (f.complementoPrevio && f.complementoPrevio.parcialidad >= u.parcialidad) continue;
            mapa.set(f.uuid, { ...f, complementoPrevio: u });
            aplicadas.push(`${folioDe(f)} (parc. ${u.parcialidad})`);
          }
        }
        nuevos.push({
          archivo,
          folio: [cfdi.serie, cfdi.folio].filter(Boolean).join("-"),
          receptor: cfdi.receptor.nombre,
          tono: aplicadas.length ? "ok" : "danger",
          texto: aplicadas.length
            ? `Complemento anterior de ${aplicadas.join(", ")}`
            : "Complemento que no incluye ninguna factura cargada",
        });
      }

      nuevas.forEach((f) => onElegir(f));
      const cambiadas = [...previas.values()].filter((f) => f !== c.facturas[f.uuid]);
      if (cambiadas.length > 0) onActualizar(cambiadas.map((f) => ({ f, decision: "complemento" as const })));
    } finally {
      setRenglones((prev) => [...prev, ...nuevos]);
      setLeyendo(false);
    }
  }

  const deXml = useMemo(
    () =>
      Object.values(c.facturas)
        .filter((f) => f.origen === "xml")
        .map((f) => ({ f, disp: saldoDisponible(c, f.uuid, pago.id) })),
    [c, pago.id]
  );

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          cargar(Array.from(e.dataTransfer.files ?? []));
        }}
        className={cx(
          "grid justify-items-center gap-1.5 rounded-xl border-[1.5px] border-dashed px-4 py-6 text-center transition",
          encima ? "border-brand bg-brand-050" : "border-line bg-surface-2"
        )}
      >
        <p className="text-[13.5px] font-semibold text-ink">Suelta aquí los XML de las facturas de este pago</p>
        <p className="max-w-md text-pretty text-[12.5px] text-ink-3">
          Uno o varios. Se leen en tu navegador y quedan elegidos para este pago. Si alguna ya tenía pagos fuera de
          Factubox, suelta también el XML de su último complemento.
        </p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={leyendo}
          className="focus-brand mt-1 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12.5px] font-semibold text-ink hover:border-ink-4"
        >
          {leyendo ? "Leyendo…" : "Elegir archivos"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".xml,text/xml,application/xml"
          multiple
          hidden
          onChange={(e) => {
            cargar(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
      </div>

      {renglones.length > 0 && (
        <ul className="divide-y divide-line-2 overflow-hidden rounded-xl border border-line bg-surface text-[12.5px]">
          {renglones.map((r, i) => (
            <li key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-ink-3">{r.archivo}</span>
              {r.folio && <span className="font-mono font-semibold text-ink">{r.folio}</span>}
              {r.receptor && <span className="max-w-[40%] truncate text-ink-2">{r.receptor}</span>}
              <Pill tone={r.tono}>{r.texto}</Pill>
            </li>
          ))}
        </ul>
      )}

      {deXml.length > 0 && (
        <TablaFacturas
          rfcEmisor={rfcEmisor}
          filas={deXml}
          c={c}
          pago={pago}
          receptorEd={receptoresDe(c, pago.docs.map((d) => d.uuid))[0] ?? null}
          vacio=""
          onElegir={onElegir}
          onQuitar={onQuitar}
          onDecision={onDecision}
          onActualizar={onActualizar}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* La tabla, común a las dos pestañas                                         */
/* -------------------------------------------------------------------------- */

function TablaFacturas({
  rfcEmisor,
  filas,
  c,
  pago,
  receptorEd,
  vacio,
  onElegir,
  onQuitar,
  onDecision,
  onActualizar,
}: {
  rfcEmisor: string;
  /** disp null = el saldo todavía se está consultando. */
  filas: Array<{ f: FacturaPagable; disp: number | null }>;
  c: CapturaPagos;
  pago: PagoCaptura;
  receptorEd: string | null;
  vacio: string;
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  onDecision: (uuid: string, d: Decision) => void;
  onActualizar: (cambios: Array<{ f: FacturaPagable; decision?: Decision }>) => void;
}) {
  if (filas.length === 0) {
    return (
      <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-[13px] text-ink-3">{vacio}</p>
    );
  }
  return (
    <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
      <table className="w-full border-collapse text-left text-[13px] sm:min-w-[640px]">
        <thead>
          <tr className="bg-surface-2 text-[11.5px] text-ink-3">
            <th className="w-8 px-2 py-2 sm:w-10 sm:px-3">
              <span className="sr-only">Elegir</span>
            </th>
            <th className="px-2 py-2 sm:px-3 font-semibold">Factura</th>
            <th className="hidden px-2 py-2 sm:px-3 font-semibold sm:table-cell">Receptor</th>
            <th className="hidden px-2 py-2 sm:px-3 font-semibold sm:table-cell">Fecha</th>
            <th className="hidden px-2 py-2 sm:px-3 text-right font-semibold sm:table-cell">Total</th>
            <th className="px-2 py-2 sm:px-3 text-right font-semibold">Le queda</th>
          </tr>
        </thead>
        <tbody>
          {filas.map(({ f, disp }) => {
            const elegida = pago.docs.some((d) => d.uuid === f.uuid);
            const otro = receptorEd !== null && f.receptor.rfc !== receptorEd;
            const conHistorial = elegida;
            return (
              <Fragment key={f.uuid}>
              <tr className={cx("border-t border-line-2 align-top", elegida && "bg-brand-050")}>
                <td className="px-2 py-2.5 sm:px-3">
                  <input
                    type="checkbox"
                    checked={elegida}
                    disabled={disp === null && !elegida}
                    onChange={() => (elegida ? onQuitar(f.uuid) : onElegir(f))}
                    aria-label={`Elegir ${folioDe(f)}`}
                    className="mt-0.5 size-4 accent-[var(--brand)]"
                  />
                </td>
                <td className="px-2 py-2.5 sm:px-3">
                  <span className="font-mono font-semibold text-ink">{folioDe(f)}</span>{" "}
                  {f.origen === "xml" && <Pill>XML</Pill>}
                  {/* En teléfono, receptor y fecha van aquí: sus columnas se ocultan. */}
                  <span className="block max-w-[130px] truncate text-[12px] text-ink-3 sm:hidden">
                    {f.receptor.nombre} · {f.fecha.split("-").reverse().join("/")}
                  </span>
                  {otro && <Pill tone="warn" className="sm:hidden">Otro receptor</Pill>}
                </td>
                <td className="hidden px-2 py-2.5 sm:px-3 text-ink-2 sm:table-cell">
                  <span className="block max-w-[220px] truncate">{f.receptor.nombre}</span>
                  {otro && <Pill tone="warn">Otro receptor</Pill>}
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 sm:px-3 font-mono text-ink-2 sm:table-cell">
                  {f.fecha.split("-").reverse().join("/")}
                </td>
                <td className="hidden whitespace-nowrap px-2 py-2.5 sm:px-3 text-right font-mono text-ink-2 sm:table-cell">{money(f.total, f.moneda)}</td>
                <td className="px-2 py-2.5 text-right font-mono font-semibold text-ink sm:whitespace-nowrap sm:px-3">
                  {disp === null ? <span className="text-ink-4">…</span> : money(Math.max(disp, 0), f.moneda)}
                </td>
              </tr>
              {/* Cómo sigue si ya tenía pagos (de Factubox o de otro sistema): en su propio renglón. */}
              {conHistorial && (
                <tr className={cx(elegida && "bg-brand-050")}>
                  <td />
                  <td colSpan={5} className="px-2 pb-2.5 sm:px-3">
                    <PagosAnteriores
                      f={f}
                      rfcEmisor={rfcEmisor}
                      decision={c.decisiones[f.uuid]}
                      onDecision={(d) => onDecision(f.uuid, d)}
                      onActualizar={onActualizar}
                    />
                  </td>
                </tr>
              )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Debajo de una factura marcada: cómo sigue si ya tenía pagos. Los de Factubox
 * se ven solos; los hechos en otro sistema o en el SAT se cuentan subiendo el
 * último complemento de pago de esa factura (propuesta aprobada: "al marcarla").
 */
function PagosAnteriores({
  f,
  rfcEmisor,
  decision,
  onDecision,
  onActualizar,
}: {
  f: FacturaPagable;
  rfcEmisor: string;
  decision?: Decision;
  onDecision: (d: Decision) => void;
  onActualizar: (cambios: Array<{ f: FacturaPagable; decision?: Decision }>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [rechazo, setRechazo] = useState<{ archivo: string; motivo: string } | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const nombre = `hist-${f.uuid}`;
  const usaSubido = f.complementoPrevio !== null && decision !== "primero" && (decision === "complemento" || f.previos.length === 0);
  const posterior = usaSubido ? pagoPosteriorEnFactubox(f) : null;

  async function subir(file: File | undefined) {
    if (!file) return;
    setLeyendo(true);
    setRechazo(null);
    try {
      let cfdi: Cfdi | null = null;
      try {
        cfdi = parseCfdi(await leerTexto(file));
      } catch {
        cfdi = null;
      }
      const r = revisarComplementoPrevio(cfdi, file.name, f, rfcEmisor);
      if (r.estado === "rechazado") setRechazo({ archivo: file.name, motivo: r.motivo });
      else onActualizar([{ f: { ...f, complementoPrevio: r.previo }, decision: "complemento" }]);
    } finally {
      setLeyendo(false);
    }
  }

  const archivo = (
    <input
      ref={inputRef}
      type="file"
      accept=".xml,text/xml,application/xml"
      hidden
      onChange={(e) => {
        subir(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );
  const botonSubir = (texto: string) => (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      disabled={leyendo}
      className="focus-brand rounded font-semibold text-brand underline disabled:opacity-60"
    >
      {leyendo ? "Leyendo…" : texto}
    </button>
  );

  return (
    // w-0 + min-w-full: el bloque toma el ancho que ya tiene la tabla en vez de
    // ensancharla (a 400 px empujaba "Le queda" fuera de la vista).
    <div className="w-0 min-w-full space-y-1.5 text-[12px] text-ink-3">
      {archivo}

      {/* Pagos que Factubox ya conoce. */}
      {f.previos.length > 0 && !usaSubido && (
        <div role="radiogroup" aria-label={`Pagos anteriores de ${folioDe(f)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span>
            {f.previos.length} pago{f.previos.length === 1 ? "" : "s"} en Factubox:
          </span>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name={nombre} checked={decision !== "cero"} onChange={() => onDecision("ultimo")} className="accent-[var(--brand)]" />
            seguir desde el último (parc. {inicio(f, "ultimo").parcialidad})
          </label>
          <label className="inline-flex items-center gap-1.5">
            <input type="radio" name={nombre} checked={decision === "cero"} onChange={() => onDecision("cero")} className="accent-[var(--brand)]" />
            desde cero
          </label>
        </div>
      )}

      {usaSubido && f.complementoPrevio ? (
        <div className="space-y-1">
          <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="font-semibold text-ok">✓ Sigue del complemento {f.complementoPrevio.archivo}:</span>
            <span className="text-ink-2">
              parcialidad {f.complementoPrevio.parcialidad + 1} · saldo {money(f.complementoPrevio.insoluto, f.moneda)}
            </span>
            <button
              type="button"
              onClick={() => onActualizar([{ f: { ...f, complementoPrevio: null }, decision: "ultimo" }])}
              className="focus-brand rounded font-semibold text-ink-3 underline hover:text-danger"
            >
              Quitar
            </button>
          </p>
          {posterior !== null && (
            <p className="text-warn">
              Factubox tiene un pago posterior (parcialidad {posterior}); se seguirá del que subiste.
            </p>
          )}
        </div>
      ) : (
        <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span>
            {f.previos.length > 0
              ? "¿Hay un pago más reciente hecho en otro sistema o en el SAT?"
              : "¿Ya se le hizo un pago en otro sistema o en el SAT?"}
          </span>
          {botonSubir("Subir su último complemento de pago")}
        </p>
      )}

      {rechazo && (
        <p role="alert" className="flex flex-wrap items-baseline gap-x-2 text-danger">
          <span>
            ✕ {rechazo.archivo} {rechazo.motivo}
          </span>
          {botonSubir("Subir otro")}
        </p>
      )}
    </div>
  );
}
