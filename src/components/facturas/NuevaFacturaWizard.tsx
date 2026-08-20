"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  Note,
  Pill,
  Stepper,
  buttonClass,
  cx,
  useToast,
  type PasoEstado,
} from "@/components/ui";
import { money } from "@/lib/cfdi";
import {
  BORRADOR_INICIAL,
  CONCEPTO_VACIO,
  PASOS,
  RFC_PUBLICO_GENERAL,
  calcularTotales,
  etiquetaTipo,
  receptorDe,
  validar,
  type FacturaBorrador,
  type PasoId,
} from "@/lib/facturaNueva";
import {
  PasoConceptos,
  PasoEmisor,
  PasoReceptor,
  PasoRevision,
  PasoTipo,
  ResultadoTimbrado,
} from "./PasosNuevaFactura";
import { RelacionarFacturaModal } from "./RelacionarFacturaModal";
import { ReceptorFormModal } from "@/components/receptores/ReceptorFormModal";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
import type { TimbrarResult } from "@/lib/timbrado";
import { TIMBRES_BAJOS, type Timbres } from "@/lib/timbresShared";

export function NuevaFacturaWizard({
  emisores,
  timbres,
}: {
  emisores: Emisor[];
  timbres: Timbres | null;
}) {
  const toast = useToast();

  const [borrador, setBorrador] = useState<FacturaBorrador>(() => ({
    ...BORRADOR_INICIAL,
    rfcEmisor: emisores[0]?.Rfc ?? "",
  }));
  const [pasoActual, setPasoActual] = useState<PasoId>("tipo");
  /** Pasos donde el usuario ya intentó avanzar: solo ahí se pintan los errores. */
  const [intentados, setIntentados] = useState<PasoId[]>([]);

  /**
   * Series y receptores se cachean junto con la "clave" de la consulta que los
   * produjo. Derivar el estado de carga comparando claves evita un setState
   * síncrono dentro del efecto, que la regla react-hooks/set-state-in-effect
   * de esta versión de Next rechaza.
   */
  const claveSeries = `${borrador.rfcEmisor}|${borrador.tipo}`;
  const [cacheSeries, setCacheSeries] = useState<{ clave: string; series: Serie[] } | null>(
    null
  );
  const series = useMemo(
    () => (cacheSeries?.clave === claveSeries ? cacheSeries.series : []),
    [cacheSeries, claveSeries]
  );
  const cargandoSeries = Boolean(borrador.rfcEmisor) && cacheSeries?.clave !== claveSeries;

  const [cacheReceptores, setCacheReceptores] = useState<{
    clave: string;
    receptores: Receptor[];
  } | null>(null);
  const receptores = useMemo(
    () =>
      cacheReceptores?.clave === borrador.rfcEmisor ? cacheReceptores.receptores : [],
    [cacheReceptores, borrador.rfcEmisor]
  );
  const cargandoReceptores =
    Boolean(borrador.rfcEmisor) && cacheReceptores?.clave !== borrador.rfcEmisor;

  const [modalRelacion, setModalRelacion] = useState(false);
  const [modalReceptor, setModalReceptor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TimbrarResult | null>(null);

  function set(cambios: Partial<FacturaBorrador>) {
    setBorrador((prev) => ({ ...prev, ...cambios }));
  }

  /* ---------- Series: dependen del emisor Y del tipo de comprobante ------- */
  useEffect(() => {
    if (!borrador.rfcEmisor) return;
    let vivo = true;

    fetch(`/api/empresas/${encodeURIComponent(borrador.rfcEmisor)}/series`)
      .then((res) => res.json())
      .then((body) => {
        if (!vivo) return;
        const delTipo: Serie[] = (body.series ?? []).filter(
          (s: Serie) => s.Tipo === borrador.tipo
        );
        setCacheSeries({ clave: claveSeries, series: delTipo });
        // Autoselecciona si solo hay una: es el caso común y ahorra un clic.
        setBorrador((prev) =>
          prev.serie && delTipo.some((s) => s.Nombre === prev.serie)
            ? prev
            : { ...prev, serie: delTipo.length === 1 ? delTipo[0].Nombre : "", folio: "" }
        );
      });

    return () => {
      vivo = false;
    };
  }, [borrador.rfcEmisor, borrador.tipo, claveSeries]);

  /* ---------- Receptores del emisor -------------------------------------- */
  useEffect(() => {
    if (!borrador.rfcEmisor) return;
    let vivo = true;
    const clave = borrador.rfcEmisor;

    fetch(`/api/empresas/${encodeURIComponent(clave)}/receptores`)
      .then((res) => res.json())
      .then(
        (body) => vivo && setCacheReceptores({ clave, receptores: body.receptores ?? [] })
      );

    return () => {
      vivo = false;
    };
  }, [borrador.rfcEmisor]);

  /* ---------- Folio: el siguiente de la serie elegida --------------------- */
  useEffect(() => {
    if (!borrador.rfcEmisor || !borrador.serie) return;
    let vivo = true;
    const serieInfo = series.find((s) => s.Nombre === borrador.serie);

    fetch(
      `/api/facturas/folio?rfc=${encodeURIComponent(borrador.rfcEmisor)}&serie=${encodeURIComponent(borrador.serie)}`
    )
      .then((res) => res.json())
      .then((body) => {
        if (!vivo) return;
        const ultimo = body.ultimoFolio ?? 0;
        const siguiente =
          ultimo > 0 ? ultimo + 1 : parseInt(serieInfo?.Inicio ?? "1", 10) || 1;
        setBorrador((prev) => ({ ...prev, folio: String(siguiente) }));
      });

    return () => {
      vivo = false;
    };
  }, [borrador.rfcEmisor, borrador.serie, series]);

  /* ---------- Validación en vivo ----------------------------------------- */
  const ctx = useMemo(
    () => ({ emisores, series, receptores }),
    [emisores, series, receptores]
  );
  const problemas = useMemo(() => validar(borrador, ctx), [borrador, ctx]);
  const receptorActual = useMemo(() => receptorDe(borrador, ctx), [borrador, ctx]);
  const totales = useMemo(() => calcularTotales(borrador.conceptos), [borrador.conceptos]);

  const indiceActual = PASOS.findIndex((p) => p.id === pasoActual);
  const problemasPendientes = PASOS.flatMap((p) => problemas[p.id]);
  const todoValido = problemasPendientes.length === 0;

  // Si el saldo no se pudo leer (`null`) no se bloquea nada: se prefiere dejar
  // pasar y que el PAC decida antes que impedir emitir por un fallo de lectura.
  const sinTimbres = timbres !== null && timbres.disponibles <= 0;
  const pocosTimbres =
    timbres !== null &&
    timbres.disponibles > 0 &&
    timbres.disponibles <= TIMBRES_BAJOS;

  /**
   * Estado de cada paso en el indicador. Un paso solo se marca en rojo si el
   * usuario ya pasó por él: no tiene sentido regañarlo por datos que todavía
   * no le hemos pedido.
   */
  const pasosStepper = PASOS.map((p, i) => {
    const suyos = problemas[p.id];
    const visitado = intentados.includes(p.id) || i < indiceActual;
    let estado: PasoEstado = "pendiente";
    if (p.id === pasoActual) estado = "actual";
    else if (suyos.length > 0 && visitado) estado = "error";
    else if (visitado) estado = "completo";
    return {
      id: p.id,
      titulo: p.titulo,
      descripcion: p.descripcion,
      estado,
      faltantes: suyos.length,
    };
  });

  function irA(id: string) {
    setIntentados((prev) => (prev.includes(pasoActual) ? prev : [...prev, pasoActual]));
    setPasoActual(id as PasoId);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function siguiente() {
    setIntentados((prev) => (prev.includes(pasoActual) ? prev : [...prev, pasoActual]));
    if (problemas[pasoActual].length > 0) {
      toast("Faltan datos en este paso", "danger");
      return;
    }
    const proximo = PASOS[indiceActual + 1];
    if (proximo) {
      setPasoActual(proximo.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function atras() {
    const previo = PASOS[indiceActual - 1];
    if (previo) {
      setPasoActual(previo.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  async function timbrar() {
    setErrorEnvio(null);
    setIntentados(PASOS.map((p) => p.id));

    if (!todoValido) {
      toast("Todavía faltan datos", "danger");
      return;
    }

    const emisor = emisores.find((e) => e.Rfc === borrador.rfcEmisor);
    if (!emisor || !receptorActual) return;

    setEnviando(true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoDeComprobante: borrador.tipo,
          cfdiRelacionados:
            borrador.tipo === "E" && borrador.relacion.uuids.length > 0
              ? borrador.relacion
              : undefined,
          emisorToken: emisor.Token,
          rfcEmisor: emisor.Rfc,
          nombreEmisor: emisor.Nombre,
          regimenEmisor: emisor.Regimen,
          lugarExpedicion: emisor.LugarExp,
          serie: borrador.serie,
          folio: borrador.folio,
          formaPago: borrador.formaPago,
          metodoPago: borrador.metodoPago,
          condicionesDePago: borrador.condicionesDePago.trim() || undefined,
          receptorRfc: receptorActual.Rfc,
          receptorNombre: receptorActual.Nombre,
          receptorRegimenFiscal: receptorActual.RegimenFiscal,
          receptorDomicilioFiscal: receptorActual.DomicilioFiscal,
          receptorUsoCfdi: borrador.usoCfdi,
          conceptos: borrador.conceptos,
        }),
      });
      const body = await res.json();

      if (!res.ok) {
        setErrorEnvio(body.error ?? "No se pudo timbrar la factura");
        return;
      }

      setResultado(body);
      toast("Factura timbrada");
    } catch {
      setErrorEnvio("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  function reiniciar() {
    setResultado(null);
    setErrorEnvio(null);
    setIntentados([]);
    setPasoActual("tipo");
    setBorrador((prev) => ({
      ...BORRADOR_INICIAL,
      rfcEmisor: prev.rfcEmisor,
      tipo: prev.tipo,
      serie: prev.serie,
      formaPago: prev.formaPago,
      metodoPago: prev.metodoPago,
      conceptos: [{ ...CONCEPTO_VACIO }],
      folio: "",
    }));
  }

  if (emisores.length === 0) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">Todavía no tienes emisores</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Registra la empresa con la que vas a facturar antes de emitir un CFDI.
          </p>
          <Link href="/emisores/nuevo" className={buttonClass("primary", "md", "mt-4")}>
            Registrar emisor
          </Link>
        </CardBody>
      </Card>
    );
  }

  if (resultado) {
    return (
      <ResultadoTimbrado
        uuid={resultado.UUID}
        fechaTimbrado={resultado.FechaTimbrado}
        onOtra={reiniciar}
      />
    );
  }

  const comun = {
    borrador,
    set,
    problemas: problemas[pasoActual],
    mostrarErrores: intentados.includes(pasoActual),
  };

  return (
    <div className="space-y-4">
      <Stepper pasos={pasosStepper} onIr={irA} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {pasoActual === "tipo" && <PasoTipo {...comun} />}

          {pasoActual === "emisor" && (
            <PasoEmisor
              {...comun}
              emisores={emisores}
              series={series}
              cargandoSeries={cargandoSeries}
              onAbrirRelacion={() => setModalRelacion(true)}
            />
          )}

          {pasoActual === "receptor" && (
            <PasoReceptor
              {...comun}
              receptores={receptores}
              receptorActual={receptorActual}
              cargandoReceptores={cargandoReceptores}
              onNuevoReceptor={() => setModalReceptor(true)}
            />
          )}

          {pasoActual === "conceptos" && <PasoConceptos {...comun} />}

          {pasoActual === "revision" && (
            <PasoRevision
              borrador={borrador}
              emisores={emisores}
              receptorActual={receptorActual}
              problemasTotales={PASOS.map((p) => ({
                paso: p.id,
                titulo: p.titulo,
                problemas: problemas[p.id],
              }))}
              onIrA={irA}
            />
          )}

          {/* Sin saldo el timbrado falla en el PAC con un error críptico: más
              vale decirlo antes de que llene todo el comprobante. */}
          {pasoActual === "revision" && sinTimbres && (
            <Note tone="danger" title="No te quedan timbres">
              El timbrado consume un timbre de tu cuenta y tu saldo está en cero.
              Recarga con tu distribuidor antes de emitir.
            </Note>
          )}
          {pasoActual === "revision" && pocosTimbres && (
            <Note tone="warn" title={`Te quedan ${timbres!.disponibles} timbres`}>
              Esta factura consumirá uno. Conviene recargar pronto.
            </Note>
          )}

          {errorEnvio && (
            <Note tone="danger" title="El SAT rechazó el comprobante">
              {errorEnvio}
            </Note>
          )}

          {/* ---------- Navegación ---------- */}
          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 px-4 py-3 shadow-raised backdrop-blur">
            <Button variant="ghost" onClick={atras} disabled={indiceActual === 0}>
              Atrás
            </Button>

            <div className="flex items-center gap-3">
              {problemas[pasoActual].length > 0 && (
                <span className="text-[12px] font-medium text-warn">
                  {problemas[pasoActual].length} dato
                  {problemas[pasoActual].length === 1 ? "" : "s"} por completar
                </span>
              )}
              {pasoActual === "revision" ? (
                <Button
                  variant="primary"
                  onClick={timbrar}
                  disabled={enviando || !todoValido || sinTimbres}
                >
                  {enviando ? "Timbrando…" : "Timbrar factura"}
                </Button>
              ) : (
                <Button variant="primary" onClick={siguiente}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ---------- Resumen en vivo ---------- */}
        <aside className="xl:sticky xl:top-20">
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  Resumen
                </span>
                <Pill tone={borrador.tipo === "E" ? "danger" : "ok"}>
                  {etiquetaTipo(borrador.tipo)}
                </Pill>
              </div>

              <Linea etiqueta="Emisor" valor={
                emisores.find((e) => e.Rfc === borrador.rfcEmisor)?.Nombre ?? "—"
              } />
              <Linea
                etiqueta="Folio"
                valor={borrador.serie && borrador.folio ? `${borrador.serie}-${borrador.folio}` : "—"}
                mono
              />
              <Linea
                etiqueta="Receptor"
                valor={
                  borrador.receptorRfc === RFC_PUBLICO_GENERAL
                    ? "Público en general"
                    : (receptorActual?.Nombre ?? "—")
                }
              />
              <Linea etiqueta="Conceptos" valor={String(borrador.conceptos.length)} />

              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-[12.5px] font-semibold text-ink">Total</span>
                <span className="font-mono text-lg font-bold tracking-tight text-ink">
                  {money(totales.total)}
                </span>
              </div>

              <div className="border-t border-line pt-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {todoValido ? "Listo para timbrar" : "Lo que falta"}
                </p>
                {todoValido ? (
                  <p className="text-[12.5px] text-ok">Todos los datos están completos.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {PASOS.filter((p) => problemas[p.id].length > 0).map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => irA(p.id)}
                          className={cx(
                            "focus-brand flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2",
                            pasoActual === p.id && "bg-surface-2"
                          )}
                        >
                          <span className="text-[12.5px] font-medium text-ink-2">
                            {p.titulo}
                          </span>
                          <span className="rounded-full bg-warn-bg px-2 py-px text-[11px] font-bold text-warn">
                            {problemas[p.id].length}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </CardBody>
          </Card>
        </aside>
      </div>

      {modalRelacion && (
        <RelacionarFacturaModal
          rfcEmisor={borrador.rfcEmisor}
          yaRelacionados={borrador.relacion.uuids}
          onClose={() => setModalRelacion(false)}
          onAgregar={(uuids) =>
            set({
              relacion: {
                ...borrador.relacion,
                uuids: [
                  ...borrador.relacion.uuids,
                  ...uuids.filter((u) => !borrador.relacion.uuids.includes(u)),
                ],
              },
            })
          }
        />
      )}

      {modalReceptor && (
        <ReceptorFormModal
          rfcEmisor={borrador.rfcEmisor}
          onClose={() => setModalReceptor(false)}
          onSaved={(receptor) => {
            setModalReceptor(false);
            setCacheReceptores((prev) =>
              prev ? { ...prev, receptores: [...prev.receptores, receptor] } : prev
            );
            set({ receptorRfc: receptor.Rfc, usoCfdi: receptor.UsoCfdi || borrador.usoCfdi });
            toast("Receptor agregado");
          }}
        />
      )}
    </div>
  );
}

function Linea({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[12px] text-ink-3">{etiqueta}</span>
      <span
        className={cx(
          "truncate text-right text-[12.5px] font-semibold text-ink",
          mono && "font-mono"
        )}
      >
        {valor}
      </span>
    </div>
  );
}
