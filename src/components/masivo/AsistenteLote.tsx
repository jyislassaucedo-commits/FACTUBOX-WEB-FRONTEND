"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Note, Pill, Segmented, Select, buttonClass, cx, useToast } from "@/components/ui";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import { AsistentePasos } from "@/components/asistente/AsistentePasos";
import type { EstadoPaso, PasoRiel } from "@/components/facturas/nueva/RielPasos";
import { IconoMenu } from "@/components/facturas/nueva/MenuTipos";
import { money } from "@/lib/cfdi";
import type { Emisor } from "@/lib/emisores";
import type { ItemResultado, ResumenLote } from "@/lib/masivoShared";
import { TablaItems, guardarRespuesta } from "./PanelLote";

/* ---------------------------------------------------------------------------
   Timbrar desde Excel, en el mismo asistente que el resto.
   ---------------------------------------------------------------------------
   Cuatro pasos: qué timbras, la plantilla, revisar renglones y timbrar. Los
   dos primeros viven en /facturas/nueva?modo=plantilla; al subir el archivo el
   PHP lo lee y crea un LOTE en revisión, y los dos últimos se hacen sobre ese
   lote en /facturas/lotes/<id>, que tiene dirección propia (se puede recargar
   o mandar el enlace). Nada se timbra hasta el último paso.

   La columna derecha no es un comprobante sino el resumen del lote: cuántos
   van, cuántos traen algo y el total. Es la opción A del mockup aprobado.
--------------------------------------------------------------------------- */

export type TipoLote = "PREFACTURA" | "PAGO" | "NOMINA";

const TIPOS: Record<TipoLote, { etiqueta: string; unidad: string; detalle: string; serie: string; nota: string; horizontal: boolean }> = {
  PREFACTURA: {
    etiqueta: "Facturas",
    unidad: "facturas",
    detalle: "Ingreso, uno o varios renglones por factura.",
    serie: "A",
    nota: "Los renglones que traigan algo por corregir no se timbran. Puedes corregir el archivo y volver a subirlo.",
    horizontal: true,
  },
  PAGO: {
    etiqueta: "Complementos de pago",
    unidad: "complementos",
    detalle: "Un pago por renglón, con las facturas que cubre.",
    serie: "P",
    nota: "Cada complemento lleva facturas de un solo receptor.",
    horizontal: false,
  },
  NOMINA: {
    etiqueta: "Recibos de nómina",
    unidad: "recibos",
    detalle: "Un recibo por empleado, con percepciones y deducciones.",
    serie: "N",
    nota: "La plantilla trae los importes ya calculados y se timbran tal cual, sin recalcular el ISR. Para que el sistema calcule, usa la corrida de nómina.",
    horizontal: true,
  },
};

export function tipoLoteDe(valor: string | null | undefined): TipoLote {
  const v = (valor ?? "").toUpperCase();
  return v === "PAGO" || v === "NOMINA" ? v : "PREFACTURA";
}

const PASOS = [
  { id: "que", titulo: "Emisor y qué timbras", pregunta: "¿Quién emite y qué vas a timbrar?", porque: "Cada plantilla trae un solo tipo: facturas, complementos de pago o recibos de nómina." },
  { id: "archivo", titulo: "Plantilla", pregunta: "¿Qué plantilla subes?", porque: "Usa la plantilla de Factubox, la misma que el escritorio. Al subirla se revisa renglón por renglón; todavía no se timbra nada." },
  { id: "renglones", titulo: "Revisar renglones", pregunta: "¿Todo está bien?", porque: "Cada renglón se revisó antes de timbrar. Los que traen algo por corregir se quedan fuera." },
  { id: "timbrar", titulo: "Timbrar lote", pregunta: "Timbra el lote", porque: "Se timbran en segundo plano. Puedes cerrar esta ventana y seguirlos en Lotes." },
] as const;

type PasoLoteId = (typeof PASOS)[number]["id"];

function riel(actual: number, resumenes: Partial<Record<PasoLoteId, string>>, faltan: Partial<Record<PasoLoteId, number>> = {}): PasoRiel[] {
  return PASOS.map((p, i) => {
    const n = faltan[p.id] ?? 0;
    let estado: EstadoPaso = "pendiente";
    if (i === actual) estado = "actual";
    else if (i < actual) estado = n > 0 ? "falta" : "hecho";
    return {
      id: p.id,
      titulo: p.titulo,
      estado,
      resumen: i < actual ? resumenes[p.id] : undefined,
      habilitado: i <= actual || i < 2,
    };
  });
}

/* ========================================================================= */
/* Pasos 1 y 2: elegir y subir                                               */
/* ========================================================================= */

export function SubirLote({
  emisores,
  rfcInicial,
  tipoInicial,
  onCambiarTipo,
}: {
  emisores: Emisor[];
  rfcInicial: string;
  tipoInicial: TipoLote;
  /** Dentro de Nueva factura se vuelve al menú sin navegar. */
  onCambiarTipo?: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const progreso = useProgresoManual();
  const inputRef = useRef<HTMLInputElement>(null);

  const [paso, setPaso] = useState(0);
  const [rfc, setRfc] = useState(rfcInicial || emisores[0]?.Rfc || "");
  const [tipo, setTipo] = useState<TipoLote>(tipoInicial);
  const [serie, setSerie] = useState("");
  /**
   * Contra qué PAC se timbra. Se queda en pruebas por omisión a propósito:
   * equivocarse de archivo con 230 facturas contra producción son 230
   * cancelaciones, y contra pruebas no es nada.
   */
  const [modoTimbrado, setModoTimbrado] = useState<"PRUEBAS" | "PRODUCCION">("PRUEBAS");
  const [layout, setLayout] = useState<"VERTICAL" | "HORIZONTAL">("VERTICAL");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [referencia, setReferencia] = useState("");
  const [correo, setCorreo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [intento, setIntento] = useState(false);

  const t = TIPOS[tipo];
  const emisor = emisores.find((e) => e.Rfc === rfc);
  const layoutEfectivo = t.horizontal ? layout : "VERTICAL";

  async function descargarVacia() {
    const res = await fetch("/api/masivo/plantilla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc, tipo, layout: layoutEfectivo }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      toast(j?.error ?? "No se pudo bajar la plantilla", "danger");
      return;
    }
    // La ruta devuelve el .xlsx ya en bytes, con su nombre en la cabecera.
    await guardarRespuesta(res);
  }

  async function revisar() {
    setIntento(true);
    if (!archivo) {
      setError("Falta el archivo.");
      return;
    }
    setError(null);
    setSubiendo(true);
    const terminar = progreso("Leyendo la plantilla…", true);
    try {
      const fd = new FormData();
      fd.append("rfc", rfc);
      fd.append("archivo", archivo);
      fd.append("modo", modoTimbrado);
      fd.append("serie", serie);
      fd.append("referencia", referencia || archivo.name);
      if (correo) fd.append("enviarCorreo", "1");

      const res = await fetch("/api/masivo/crear", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok || !body.lote?.IdLote) {
        setError(body.error ?? "No se pudo leer el archivo");
        return;
      }
      // Subir dos veces el mismo archivo devuelve el lote de la primera vez en
      // lugar de duplicarlo. Sin decirlo, el usuario cree que acaba de crear
      // uno nuevo y se encuentra con un lote ya timbrado.
      const aviso = body.lote.Aviso ?? body.lote.Repetido;
      if (aviso) toast(aviso);
      router.push(`/facturas/lotes/${body.lote.IdLote}`);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      terminar();
      setSubiendo(false);
    }
  }

  const p = PASOS[paso];
  const faltaArchivo = paso === 1 && intento && !archivo;

  return (
    <AsistentePasos
      riel={{
        tipo: "Timbrar desde Excel",
        folio: t.etiqueta,
        icono: <IconoMenu icono="excel" />,
        pasos: riel(paso, { que: `${t.etiqueta} · ${emisor?.Nombre ?? rfc}`, archivo: archivo?.name }),
        onIr: (id) => {
          const i = PASOS.findIndex((x) => x.id === id);
          if (i <= 1) setPaso(i);
        },
      }}
      indice={paso}
      total={PASOS.length}
      pregunta={p.pregunta}
      porque={p.porque}
      textoVerDocumento="Ver el resumen del lote"
      documento={
        <ResumenAntes
          tipo={tipo}
          emisor={emisor?.Nombre ?? rfc}
          rfc={rfc}
          archivo={archivo?.name ?? null}
          modoTimbrado={modoTimbrado}
        />
      }
      debajo={error && <Note tone="danger" title="No se pudo leer la plantilla">{error}</Note>}
      pie={{
        izquierda:
          paso === 0 ? (
            onCambiarTipo ? (
              <Button variant="ghost" onClick={onCambiarTipo}>
                Cambiar tipo
              </Button>
            ) : (
              <Link href="/facturas/nueva" className={buttonClass("ghost")}>
                Cambiar tipo
              </Link>
            )
          ) : (
            <Button variant="ghost" onClick={() => setPaso(0)} disabled={subiendo}>
              Atrás
            </Button>
          ),
        derecha: (
          <>
            {faltaArchivo && <span className="text-[12px] font-medium text-warn">Falta el archivo</span>}
            {paso === 0 ? (
              <Button variant="primary" onClick={() => setPaso(1)} disabled={!rfc}>
                Continuar
              </Button>
            ) : (
              <Button variant="primary" onClick={revisar} disabled={subiendo}>
                {subiendo ? "Revisando…" : "Revisar el archivo"}
              </Button>
            )}
          </>
        ),
      }}
    >
      {paso === 0 && (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink-2">Emisor</span>
              <Select value={rfc} onChange={(e) => setRfc(e.target.value)}>
                {emisores.map((e) => (
                  <option key={e.Rfc} value={e.Rfc}>
                    {e.Nombre} · {e.Rfc}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12.5px] font-semibold text-ink-2">Serie</span>
              <input
                type="text"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                placeholder={`La del archivo (por ejemplo ${t.serie})`}
                className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
              />
              <span className="text-[11.5px] text-ink-4">Se usa donde el archivo no traiga una.</span>
            </label>
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-[12.5px] font-semibold text-ink-2">¿Qué trae la plantilla?</legend>
            <div className="grid gap-2.5 sm:grid-cols-3">
              {(Object.keys(TIPOS) as TipoLote[]).map((k) => (
                <label
                  key={k}
                  className={cx(
                    "flex cursor-pointer flex-col gap-0.5 rounded-xl border-[1.5px] px-4 py-3 transition",
                    tipo === k ? "border-brand bg-brand-050" : "border-line bg-surface hover:border-brand-100"
                  )}
                >
                  <input type="radio" name="tipo-lote" className="sr-only" checked={tipo === k} onChange={() => setTipo(k)} />
                  <span className="text-[14px] font-semibold text-ink">{TIPOS[k].etiqueta}</span>
                  <span className="text-[12.5px] leading-snug text-ink-3">{TIPOS[k].detalle}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <span className="block text-[12.5px] font-semibold text-ink-2">¿Contra qué PAC?</span>
            <Segmented<"PRUEBAS" | "PRODUCCION">
              ariaLabel="Modo de timbrado"
              value={modoTimbrado}
              onChange={setModoTimbrado}
              options={[
                { value: "PRUEBAS", label: "Pruebas" },
                { value: "PRODUCCION", label: "Producción" },
              ]}
            />
            <p className="text-[12px] text-ink-3">En pruebas no se consumen timbres ni tienen validez fiscal.</p>
          </div>
        </div>
      )}

      {paso === 1 && (
        <div className="space-y-4">
          {t.horizontal && (
            <div className="space-y-1.5">
              <span className="block text-[12.5px] font-semibold text-ink-2">Formato de la plantilla</span>
              <Segmented<"VERTICAL" | "HORIZONTAL">
                ariaLabel="Formato de la plantilla"
                value={layout}
                onChange={setLayout}
                options={[
                  { value: "VERTICAL", label: "Vertical" },
                  { value: "HORIZONTAL", label: "Horizontal" },
                ]}
              />
              <p className="text-[12px] text-ink-3">
                {layout === "VERTICAL"
                  ? `Un renglón por ${tipo === "NOMINA" ? "percepción o deducción" : "concepto"}: admite muchos por comprobante.`
                  : `Un renglón por ${tipo === "NOMINA" ? "empleado, con una columna por percepción" : "comprobante"}.`}{" "}
                Al subirla se reconoce sola; esto solo decide cuál descargas.
              </p>
            </div>
          )}

          <div
            className={cx(
              "rounded-card border border-dashed px-4 py-6 text-center transition",
              archivo ? "border-brand bg-brand-050/30" : faltaArchivo ? "border-warn bg-warn-bg" : "border-line bg-surface-2"
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx"
              className="sr-only"
              onChange={(e) => {
                setArchivo(e.target.files?.[0] ?? null);
                setError(null);
              }}
            />
            {archivo ? (
              <>
                <p className="text-[14px] font-semibold text-ink">{archivo.name}</p>
                <p className="mt-0.5 text-[12.5px] text-ink-3">{(archivo.size / 1024).toFixed(0)} KB</p>
              </>
            ) : (
              <p className="text-[14px] font-semibold text-ink">Ningún archivo elegido</p>
            )}
            <button type="button" onClick={() => inputRef.current?.click()} className={buttonClass("secondary", "sm", "mt-3")}>
              {archivo ? "Cambiar archivo" : "Elegir archivo .xlsx"}
            </button>
            <p className="mt-2 text-[12px] text-ink-3">Hasta 2,000 comprobantes y 16 MB por archivo.</p>
          </div>

          <p className="text-[13px] text-ink-3">
            ¿No la tienes?{" "}
            <button type="button" onClick={descargarVacia} className="focus-brand rounded font-semibold text-brand hover:underline">
              Descargar plantilla vacía de {t.etiqueta.toLowerCase()}
            </button>
          </p>

          <label className="flex max-w-md flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ink-2">Referencia</span>
            <input
              type="text"
              value={referencia}
              onChange={(e) => setReferencia(e.target.value)}
              placeholder={tipo === "NOMINA" ? "Quincena 18" : "Facturación de septiembre"}
              className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
            />
            <span className="text-[11.5px] text-ink-4">Para reconocer el lote después.</span>
          </label>

          <label className="flex cursor-pointer items-center gap-2">
            <input type="checkbox" checked={correo} onChange={(e) => setCorreo(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
            <span className="text-[13.5px] text-ink-2">
              Avisar por correo a {tipo === "NOMINA" ? "los empleados" : "los receptores"} que traigan dirección en el archivo
            </span>
          </label>
        </div>
      )}
    </AsistentePasos>
  );
}

function ResumenAntes({
  tipo,
  emisor,
  rfc,
  archivo,
  modoTimbrado,
}: {
  tipo: TipoLote;
  emisor: string;
  rfc: string;
  archivo: string | null;
  modoTimbrado: "PRUEBAS" | "PRODUCCION";
}) {
  const t = TIPOS[tipo];
  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Lote</span>
          <Pill tone={modoTimbrado === "PRODUCCION" ? "warn" : "neutral"}>{modoTimbrado === "PRODUCCION" ? "Producción" : "Pruebas"}</Pill>
        </div>
        <Linea etiqueta="Qué se timbra" valor={t.etiqueta} />
        <Linea etiqueta="Emisor" valor={emisor} />
        <Linea etiqueta="RFC" valor={rfc} mono />
        <Linea etiqueta="Archivo" valor={archivo ?? "—"} />
        <p className="border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-3">
          Al subir el archivo se revisa cada renglón y ves cuántos {t.unidad} están listos antes de gastar un solo timbre.
        </p>
        <Note tone="info">{t.nota}</Note>
      </CardBody>
    </Card>
  );
}

/* ========================================================================= */
/* Pasos 3 y 4: el lote ya creado, en revisión                               */
/* ========================================================================= */

export function RevisarLote({
  lote,
  items,
  ocupado,
  error,
  onConfirmar,
  onDescargarReporte,
}: {
  lote: ResumenLote;
  items: ItemResultado[];
  ocupado: boolean;
  error: string | null;
  onConfirmar: () => void;
  onDescargarReporte: () => void;
}) {
  const [paso, setPaso] = useState(2);
  const [soloErrores, setSoloErrores] = useState(false);
  const tipo = tipoLoteDe(lote.Tipo);
  const t = TIPOS[tipo];
  const conErrores = items.filter((i) => i.Errores.length > 0);
  const validos = lote.Total - lote.Invalidos;
  const total = items
    .filter((i) => i.Errores.length === 0)
    .reduce((s, i) => s + (Number(String(i.Total).replace(/,/g, "")) || 0), 0);
  const nuevo = `/facturas/nueva?modo=plantilla&plantilla=${tipo}`;
  const p = PASOS[paso];
  const visibles = soloErrores ? conErrores : items;

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span>
          <Link href="/facturas/lotes" className="hover:text-brand">Lotes</Link>
          <span aria-hidden> / </span>
          <span className="font-medium text-ink-2">
            Lote #{lote.IdLote}
            {lote.Referencia ? ` · ${lote.Referencia}` : ""}
          </span>
        </span>
      </nav>

      <AsistentePasos
        riel={{
          tipo: "Timbrar desde Excel",
          folio: `Lote #${lote.IdLote}`,
          icono: <IconoMenu icono="excel" />,
          pasos: riel(
            paso,
            { que: t.etiqueta, archivo: lote.Referencia ?? undefined, renglones: conErrores.length > 0 ? `${conErrores.length} por corregir` : "Todo bien" },
            { renglones: conErrores.length }
          ),
          onIr: (id) => {
            const i = PASOS.findIndex((x) => x.id === id);
            // Los dos primeros ya pasaron: volver a ellos es subir otro archivo.
            if (i >= 2) setPaso(i);
          },
        }}
        indice={paso}
        total={PASOS.length}
        pregunta={p.pregunta}
        porque={p.porque}
        textoVerDocumento="Ver el resumen del lote"
        documento={
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[14px] font-bold text-ink">{t.etiqueta}</span>
                <Pill tone={paso === 3 ? "info" : "warn"}>{paso === 3 ? "Listo para timbrar" : "En revisión"}</Pill>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Cifra valor={validos} etiqueta={`${t.unidad} listos`} />
                <Cifra valor={lote.Invalidos} etiqueta="con algo por corregir" tono={lote.Invalidos > 0 ? "warn" : undefined} />
              </div>
              {lote.Total > 0 && (
                <div className="flex h-2 overflow-hidden rounded-full bg-line-2" aria-hidden>
                  <span className="h-full bg-ok" style={{ width: `${(validos / lote.Total) * 100}%` }} />
                  <span className="h-full bg-warn" style={{ width: `${(lote.Invalidos / lote.Total) * 100}%` }} />
                </div>
              )}
              <Linea etiqueta="Importe de los listos" valor={money(total)} mono />
              <Linea etiqueta="Timbres que consume" valor={String(validos)} mono />
              <Note tone="info">{t.nota}</Note>
              <Button variant="ghost" size="sm" onClick={onDescargarReporte} disabled={ocupado}>
                Reporte en Excel
              </Button>
            </CardBody>
          </Card>
        }
        debajo={
          <>
            {lote.Mensaje && lote.Mensaje !== "-" && <Note tone="warn">{lote.Mensaje}</Note>}
            {error && <Note tone="danger" title="No se pudo">{error}</Note>}
          </>
        }
        pie={{
          izquierda:
            paso === 2 ? (
              <Link href={nuevo} className={buttonClass("ghost")}>
                Subir otro archivo
              </Link>
            ) : (
              <Button variant="ghost" onClick={() => setPaso(2)} disabled={ocupado}>
                Atrás
              </Button>
            ),
          derecha: (
            <>
              {paso === 2 && conErrores.length > 0 && (
                <span className="text-[12px] font-medium text-warn">{conErrores.length} por corregir</span>
              )}
              {paso === 2 ? (
                <Button variant="primary" onClick={() => setPaso(3)}>
                  Continuar
                </Button>
              ) : (
                <Button variant="primary" onClick={onConfirmar} disabled={ocupado || validos === 0}>
                  {ocupado ? "Enviando…" : `Timbrar ${validos} ${t.unidad}`}
                </Button>
              )}
            </>
          ),
        }}
      >
        {paso === 2 && (
          <div className="space-y-3">
            {conErrores.length > 0 && (
              <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-2">
                <input type="checkbox" checked={soloErrores} onChange={(e) => setSoloErrores(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                Ver solo los {conErrores.length} que tienen algo
              </label>
            )}
            {visibles.length > 0 ? (
              <TablaItems items={visibles} />
            ) : (
              <p className="text-[13px] text-ink-3">El archivo no trajo renglones.</p>
            )}
          </div>
        )}
        {paso === 3 && (
          <div className="space-y-3">
            {lote.Invalidos > 0 ? (
              <Note tone="warn" title={`${lote.Invalidos} ${lote.Invalidos === 1 ? "renglón se queda" : "renglones se quedan"} fuera`}>
                Traen algo por corregir y no se timbran. Se timbran {validos}.
              </Note>
            ) : (
              <Note tone="info" title="Todo está listo">
                Los {lote.Total} {t.unidad} pasaron la revisión.
              </Note>
            )}
            <dl className="divide-y divide-line-2 text-[13px]">
              <Fila etiqueta="Qué se timbra" valor={t.etiqueta} />
              <Fila etiqueta="Archivo" valor={lote.Referencia ?? "—"} />
              <Fila etiqueta="Se timbran" valor={`${validos} de ${lote.Total} · ${money(total)}`} />
            </dl>
          </div>
        )}
      </AsistentePasos>
    </div>
  );
}

function Cifra({ valor, etiqueta, tono }: { valor: number; etiqueta: string; tono?: "warn" }) {
  return (
    <div className="rounded-xl border border-line px-3 py-2.5">
      <span className={cx("block text-[20px] font-bold tabular-nums tracking-tight", tono === "warn" ? "text-warn" : "text-ink")}>
        {valor.toLocaleString("es-MX")}
      </span>
      <span className="text-[12px] text-ink-3">{etiqueta}</span>
    </div>
  );
}

function Linea({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 shrink-0 text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className={cx("min-w-0 truncate text-right text-[12.5px] font-semibold text-ink", mono && "font-mono")}>{valor}</span>
    </div>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex justify-between gap-3 py-2">
      <dt className="text-ink-3">{etiqueta}</dt>
      <dd className="text-right font-medium text-ink">{valor}</dd>
    </div>
  );
}
