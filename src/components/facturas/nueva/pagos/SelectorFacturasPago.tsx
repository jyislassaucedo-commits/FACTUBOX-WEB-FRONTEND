"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Input, Note, Pill, SearchInput, Segmented, cx } from "@/components/ui";
import { money, parseCfdi, type Cfdi } from "@/lib/cfdi";
import type { Factura } from "@/lib/facturasShared";
import {
  desdeApi,
  desdeXml,
  folioDe,
  inicio,
  receptoresDe,
  saldoDisponible,
  ultimaParcialidadEn,
  type CapturaPagos,
  type Decision,
  type FacturaPagable,
  type FacturaRelacionadaApi,
  type PagoCaptura,
} from "@/lib/pagosCaptura";

/*
   Primer subpaso del pago: qué facturas cubre. Salen de Factubox (PPD
   vigentes con saldo) o de XML que el usuario suelta. En cada renglón se
   decide cómo sigue una factura que ya tenía pagos.
*/

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

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

/** Renglones que se muestran de entrada y cuántos más con "Mostrar más". */
const PAGINA = 25;
/** Detalles por llamada: cada factura cuesta ~150 ms en el backend (lee su XML). */
const LOTE = 10;

/** Lo que el listado ya trae, para pintar el renglón mientras llega el detalle. */
function provisional(f: Factura): FacturaPagable {
  return {
    uuid: f.Uuid.toUpperCase(),
    serie: f.Serie,
    folio: f.Folio,
    fecha: f.FechaEmision.slice(0, 10),
    total: parseFloat(f.Total) || 0,
    moneda: f.Moneda || "MXN",
    receptor: { rfc: f.RfcReceptor, nombre: f.NombreReceptor, regimen: f.RegimenReceptor, cp: f.DomicilioReceptor },
    origen: "factubox",
    traslados: [],
    retenciones: [],
    previos: [],
    complementoPrevio: null,
  };
}

function DeFactubox({
  rfcEmisor,
  c,
  pago,
  receptorEd,
  nombreReceptorEd,
  onElegir,
  onQuitar,
  onDecision,
}: {
  rfcEmisor: string;
  c: CapturaPagos;
  pago: PagoCaptura;
  receptorEd: string | null;
  nombreReceptorEd: string | null;
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  onDecision: (uuid: string, d: Decision) => void;
}) {
  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear() - 1, hoy.getMonth(), 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [q, setQ] = useState("");
  const [soloReceptor, setSoloReceptor] = useState(true);
  const [limite, setLimite] = useState(PAGINA);

  // El listado sale rápido (una consulta); el saldo y los impuestos de cada
  // factura, no. Se pinta la lista y el detalle llega por lotes, solo para
  // los renglones visibles.
  const clave = `${rfcEmisor}|${desde}|${hasta}`;
  const [cache, setCache] = useState<{ clave: string; facturas: Factura[]; error: string | null } | null>(null);
  const vigente = cache?.clave === clave ? cache : null;
  /** Detalle por folio fiscal; null = no está en Factubox para este emisor. */
  const [detalles, setDetalles] = useState<Record<string, FacturaPagable | null>>({});
  const [errorDetalle, setErrorDetalle] = useState<string | null>(null);
  const [enVuelo, setEnVuelo] = useState<string[]>([]);

  useEffect(() => {
    if (!rfcEmisor || desde > hasta) return;
    let vivo = true;
    const params = new URLSearchParams({
      emisor: rfcEmisor,
      tipo: "I",
      estatus: "Vigente",
      metodoPago: "PPD",
      desde,
      hasta,
    });
    fetch(`/api/facturas/buscar?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No se pudo buscar");
        // El filtro del backend es por texto: se asegura aquí también.
        return (body.facturas as Factura[])
          .filter((f) => f.MetodoPago === "PPD")
          .sort((a, b) => b.FechaEmision.localeCompare(a.FechaEmision));
      })
      .then((facturas) => vivo && setCache({ clave, facturas, error: null }))
      .catch((e: unknown) => {
        if (!vivo) return;
        setCache({ clave, facturas: [], error: e instanceof Error ? e.message : "No se pudo buscar" });
      });
    return () => {
      vivo = false;
    };
  }, [clave, rfcEmisor, desde, hasta]);

  const query = q.trim().toLowerCase();

  const { filas, hayMas } = useMemo(() => {
    const elegidas = pago.docs.map((d) => d.uuid);
    const conDetalle: CapturaPagos = {
      ...c,
      facturas: {
        ...Object.fromEntries(
          Object.entries(detalles).filter((e): e is [string, FacturaPagable] => e[1] !== null)
        ),
        ...c.facturas,
      },
    };
    const todas: Array<{ f: FacturaPagable; disp: number | null }> = [];
    for (const lf of vigente?.facturas ?? []) {
      const uuid = lf.Uuid.toUpperCase();
      if (elegidas.includes(uuid)) continue;
      const det = detalles[uuid];
      if (det === null) continue;
      if (soloReceptor && receptorEd && lf.RfcReceptor !== receptorEd) continue;
      if (
        query &&
        !`${lf.Serie}-${lf.Folio} ${lf.NombreReceptor} ${lf.RfcReceptor} ${lf.Total} ${lf.Uuid}`
          .toLowerCase()
          .includes(query)
      ) {
        continue;
      }
      const conocida = conDetalle.facturas[uuid];
      const disp = conocida ? saldoDisponible(conDetalle, uuid, pago.id) : null;
      // Ya pagada del todo: no hay nada que cubrir.
      if (disp !== null && disp <= 0.004) continue;
      todas.push({ f: conocida ?? provisional(lf), disp });
    }
    // Las elegidas van primero, aunque no salgan en el rango.
    const arriba = elegidas
      .filter((u) => conDetalle.facturas[u])
      .map((u) => ({ f: conDetalle.facturas[u], disp: saldoDisponible(conDetalle, u, pago.id) as number | null }));
    return { filas: [...arriba, ...todas.slice(0, limite)], hayMas: todas.length > limite };
  }, [vigente, detalles, c, pago.docs, pago.id, soloReceptor, receptorEd, query, limite]);

  // Trae, por lotes, el detalle de los renglones visibles que aún no lo tienen.
  const claveFaltan = filas
    .filter((x) => x.disp === null && !enVuelo.includes(x.f.uuid))
    .slice(0, LOTE)
    .map((x) => x.f.uuid)
    .join(",");
  useEffect(() => {
    if (!claveFaltan || enVuelo.length > 0) return;
    const lote = claveFaltan.split(",");
    let vivo = true;
    // Se marca en vuelo desde el callback de la promesa para no encadenar renders.
    Promise.resolve()
      .then(() => vivo && setEnVuelo(lote))
      .then(() => traerRelacionadas(rfcEmisor, lote))
      .then((lista) => {
        const nuevos: Record<string, FacturaPagable | null> = {};
        for (const a of lista) nuevos[a.Uuid.toUpperCase()] = desdeApi(a);
        for (const u of lote) if (!(u in nuevos)) nuevos[u] = null;
        setDetalles((prev) => ({ ...prev, ...nuevos }));
      })
      .catch((e: unknown) => setErrorDetalle(e instanceof Error ? e.message : "No se pudo consultar los saldos"))
      .finally(() => setEnVuelo([]));
    return () => {
      vivo = false;
    };
  }, [claveFaltan, rfcEmisor, enVuelo.length]);

  const cargando = Boolean(rfcEmisor) && !vigente && desde <= hasta;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
        <SearchInput
          placeholder="Buscar por folio, receptor o importe"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setLimite(PAGINA);
          }}
          aria-label="Buscar factura"
        />
        <Input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" />
        <Input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" />
      </div>
      {receptorEd && (
        <label className="inline-flex items-center gap-2 text-[12.5px] text-ink-2">
          <input
            type="checkbox"
            checked={soloReceptor}
            onChange={(e) => setSoloReceptor(e.target.checked)}
            className="size-4 accent-[var(--brand)]"
          />
          Solo de {nombreReceptorEd}
        </label>
      )}

      {vigente?.error && <Note tone="danger">{vigente.error}</Note>}
      {errorDetalle && <Note tone="danger">{errorDetalle}</Note>}

      <TablaFacturas
        filas={filas}
        c={c}
        pago={pago}
        receptorEd={receptorEd}
        vacio={cargando ? "Buscando facturas PPD…" : "No hay facturas PPD con saldo que coincidan."}
        onElegir={onElegir}
        onQuitar={onQuitar}
        onDecision={onDecision}
      />
      {hayMas && (
        <button
          type="button"
          onClick={() => setLimite((n) => n + PAGINA)}
          className="focus-brand rounded text-[12.5px] font-semibold text-brand underline"
        >
          Mostrar más facturas
        </button>
      )}
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
          filas={deXml}
          c={c}
          pago={pago}
          receptorEd={receptoresDe(c, pago.docs.map((d) => d.uuid))[0] ?? null}
          vacio=""
          onElegir={onElegir}
          onQuitar={onQuitar}
          onDecision={onDecision}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* La tabla, común a las dos pestañas                                         */
/* -------------------------------------------------------------------------- */

function TablaFacturas({
  filas,
  c,
  pago,
  receptorEd,
  vacio,
  onElegir,
  onQuitar,
  onDecision,
}: {
  /** disp null = el saldo todavía se está consultando. */
  filas: Array<{ f: FacturaPagable; disp: number | null }>;
  c: CapturaPagos;
  pago: PagoCaptura;
  receptorEd: string | null;
  vacio: string;
  onElegir: (f: FacturaPagable) => void;
  onQuitar: (uuid: string) => void;
  onDecision: (uuid: string, d: Decision) => void;
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
            const conHistorial = f.previos.length > 0 || f.complementoPrevio !== null;
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
                <td className="whitespace-nowrap px-2 py-2.5 sm:px-3 text-right font-mono font-semibold text-ink">
                  {disp === null ? <span className="text-ink-4">…</span> : money(Math.max(disp, 0), f.moneda)}
                </td>
              </tr>
              {/* Cómo sigue si ya tenía pagos: en su propio renglón para que se lea de corrido. */}
              {conHistorial && (
                <tr className={cx(elegida && "bg-brand-050")}>
                  <td />
                  <td colSpan={5} className="px-2 pb-2.5 sm:px-3">
                    <Historial f={f} decision={c.decisiones[f.uuid]} onDecision={(d) => onDecision(f.uuid, d)} />
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

/** Cómo sigue una factura que ya tenía pagos: lo decide el usuario. */
function Historial({
  f,
  decision,
  onDecision,
}: {
  f: FacturaPagable;
  decision?: Decision;
  onDecision: (d: Decision) => void;
}) {
  const nombre = `hist-${f.uuid}`;
  if (f.previos.length > 0) {
    const siguiente = inicio(f, "ultimo").parcialidad;
    return (
      <div role="radiogroup" aria-label={`Pagos anteriores de ${folioDe(f)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span>
          {f.previos.length} pago{f.previos.length === 1 ? "" : "s"} anterior{f.previos.length === 1 ? "" : "es"}:
        </span>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" name={nombre} checked={decision !== "cero"} onChange={() => onDecision("ultimo")} className="accent-[var(--brand)]" />
          seguir desde el último (parc. {siguiente})
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" name={nombre} checked={decision === "cero"} onChange={() => onDecision("cero")} className="accent-[var(--brand)]" />
          desde cero
        </label>
      </div>
    );
  }
  if (f.complementoPrevio) {
    return (
      <div role="radiogroup" aria-label={`Pagos anteriores de ${folioDe(f)}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-3">
        <span>Viene de fuera:</span>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" name={nombre} checked={decision !== "primero"} onChange={() => onDecision("complemento")} className="accent-[var(--brand)]" />
          sigue de {f.complementoPrevio.archivo} (parc. {f.complementoPrevio.parcialidad + 1})
        </label>
        <label className="inline-flex items-center gap-1.5">
          <input type="radio" name={nombre} checked={decision === "primero"} onChange={() => onDecision("primero")} className="accent-[var(--brand)]" />
          es el primer pago
        </label>
      </div>
    );
  }
  return null;
}
