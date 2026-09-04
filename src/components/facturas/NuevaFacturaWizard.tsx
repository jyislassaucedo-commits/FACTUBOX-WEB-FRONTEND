"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
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
  PAGO_VACIO,
  RFC_PUBLICO_GENERAL,
  calcularTotales,
  construirDoctoRelacionado,
  etiquetaTipo,
  pasosPara,
  receptorDe,
  validar,
  type FacturaBorrador,
  type PasoId,
} from "@/lib/facturaNueva";
import {
  PasoConceptos,
  PasoEmisor,
  PasoPagos,
  PasoReceptor,
  PasoRevision,
  PasoTipo,
  ResultadoTimbrado,
  RevisionSat,
} from "./PasosNuevaFactura";
import { RelacionarFacturaModal } from "./RelacionarFacturaModal";
import { ReceptorFormModal } from "@/components/receptores/ReceptorFormModal";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
import type { TimbrarResult, ValidarResult } from "@/lib/timbrado";
import { TIMBRES_BAJOS, type Timbres } from "@/lib/timbresShared";

/**
 * Lo que devolvió la última revisión contra el SAT, junto con la `clave` del
 * comprobante que se revisó. Si el borrador cambia, la clave deja de coincidir
 * y el resultado se descarta solo: un visto bueno viejo no debe amparar una
 * factura distinta.
 *
 * `motivo` es distinto de "el comprobante está mal": significa que no se pudo
 * revisar. Ese caso no bloquea el timbrado — si nuestra revisión se cae, no es
 * razón para dejar a alguien sin poder facturar.
 */
type ResultadoRevision =
  | { clave: string; datos: ValidarResult }
  | { clave: string; motivo: string };

export function NuevaFacturaWizard({
  emisores,
  timbres,
  origenRfc,
  origenUuid,
}: {
  emisores: Emisor[];
  timbres: Timbres | null;
  /** Vienen de "Pagar factura" en el detalle: saltan directo al paso de pago. */
  origenRfc?: string;
  origenUuid?: string;
}) {
  const toast = useToast();

  // "Pagar factura" manda el RFC del emisor de esa factura; si de verdad es
  // uno de los emisores del usuario, se preselecciona junto con el tipo
  // "P" y se salta directo al paso de pago (ver autoUuid en PasoPagos).
  const emisorOrigenValido = origenRfc && emisores.some((e) => e.Rfc === origenRfc);

  const [borrador, setBorrador] = useState<FacturaBorrador>(() => ({
    ...BORRADOR_INICIAL,
    rfcEmisor: emisorOrigenValido ? origenRfc! : (emisores[0]?.Rfc ?? ""),
    tipo: emisorOrigenValido && origenUuid ? "P" : BORRADOR_INICIAL.tipo,
  }));
  const [pasoActual, setPasoActual] = useState<PasoId>(
    emisorOrigenValido && origenUuid ? "pagos" : "tipo"
  );
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
  const progreso = useProgresoManual();
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  const [resultado, setResultado] = useState<TimbrarResult | null>(null);

  /**
   * Revisión del comprobante contra las reglas del SAT, hecha en el servidor.
   * Se guarda igual que las series y los receptores: junto con la clave de la
   * consulta que la produjo, para poder derivar "está revisando" comparando
   * claves en vez de con un setState dentro del efecto.
   */
  const [revision, setRevision] = useState<ResultadoRevision | null>(null);
  /** Clave cuya revisión está en vuelo, para no pedirla dos veces. */
  const revisionEnVuelo = useRef<string | null>(null);

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

  /**
   * Arma el cuerpo que esperan /api/facturas y /api/facturas/validar.
   *
   * Es el mismo para los dos a propósito: la revisión tiene que mirar
   * exactamente el comprobante que se va a timbrar, o no sirve de nada.
   * Devuelve null si todavía falta el emisor o el receptor.
   */
  function construirCuerpo() {
    const emisor = emisores.find((e) => e.Rfc === borrador.rfcEmisor);
    if (!emisor || !receptorActual) return null;

    // El <input type="datetime-local"> entrega "YYYY-MM-DDTHH:mm" (sin
    // segundos); el SAT espera "YYYY-MM-DDTHH:mm:ss".
    const fechaPagoConSegundos =
      borrador.pago.fechaPago.length === 16
        ? `${borrador.pago.fechaPago}:00`
        : borrador.pago.fechaPago;

    const docto = borrador.tipo === "P" ? construirDoctoRelacionado(borrador.pago) : null;

    return {
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
      pago:
        borrador.tipo === "P" && docto
          ? {
              fechaPago: fechaPagoConSegundos,
              formaDePagoP: borrador.pago.formaDePagoP,
              monedaP: borrador.pago.monedaP,
              tipoCambioP: borrador.pago.tipoCambioP || "1",
              monto: (parseFloat(borrador.pago.monto) || 0).toFixed(2),
              doctoRelacionado: [docto],
            }
          : undefined,
    };
  }

  /**
   * Tira el resultado guardado para que el efecto vuelva a pedir la revisión.
   * Es lo que hace el botón de reintentar cuando la revisión no respondió.
   */
  function reintentarRevision() {
    revisionEnVuelo.current = null;
    setRevision(null);
  }

  // Un CFDI de Pago no tiene receptor propio ni conceptos que capturar: el
  // paso "Pago" los reemplaza a ambos (ver pasosPara).
  const pasos = pasosPara(borrador.tipo);
  const indiceActual = pasos.findIndex((p) => p.id === pasoActual);
  const problemasPendientes = pasos.flatMap((p) => problemas[p.id]);
  const todoValido = problemasPendientes.length === 0;

  /**
   * La revisión vale solo mientras el comprobante no cambie. Se compara contra
   * el cuerpo que se mandaría ahora mismo, en vez de invalidar desde cada
   * setter: así ningún cambio se escapa y no queda un visto bueno viejo
   * amparando una factura distinta.
   */
  const claveComprobante = useMemo(
    () => {
      const cuerpo = construirCuerpo();
      return cuerpo === null ? null : JSON.stringify(cuerpo);
    },
    // Depende de todo lo que arma el comprobante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [borrador, emisores, receptorActual]
  );
  const tocaRevisar =
    pasoActual === "revision" && todoValido && claveComprobante !== null;
  const revisionVigente =
    revision !== null && revision.clave === claveComprobante ? revision : null;
  const datosRevision =
    revisionVigente !== null && "datos" in revisionVigente ? revisionVigente.datos : null;
  const falloRevision =
    revisionVigente !== null && "motivo" in revisionVigente ? revisionVigente.motivo : null;
  // Se deriva de comparar claves, como cargandoSeries: así el efecto no tiene
  // que marcar "revisando" con un setState síncrono.
  const revisandoSat = tocaRevisar && revisionVigente === null;
  const erroresSat = datosRevision?.Validacion.Errores ?? [];
  const advertenciasSat = datosRevision?.Validacion.Advertencias ?? [];
  const rechazadoPorSat = datosRevision !== null && datosRevision.Valido === "0";

  // Al llegar al último paso se revisa sola: si el usuario tuviera que pedirlo,
  // la mayoría timbraría sin hacerlo y el timbre se perdería igual.
  useEffect(() => {
    if (!tocaRevisar || claveComprobante === null) return;
    if (revision !== null && revision.clave === claveComprobante) return;
    if (revisionEnVuelo.current === claveComprobante) return;

    const cuerpo = construirCuerpo();
    if (cuerpo === null) return;
    const clave = claveComprobante;
    revisionEnVuelo.current = clave;
    let vivo = true;

    fetch("/api/facturas/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    })
      .then(async (res) => {
        const body = await res.json();
        return res.ok
          ? { clave, datos: body as ValidarResult }
          : { clave, motivo: (body.error as string) ?? "No se pudo revisar" };
      })
      .catch(() => ({ clave, motivo: "No se pudo conectar con el servidor" }))
      .then((r) => vivo && setRevision(r))
      .finally(() => {
        // Solo se libera si sigue siendo la petición vigente: si el borrador
        // cambió, la clave en vuelo ya es otra y no hay que pisarla.
        if (revisionEnVuelo.current === clave) revisionEnVuelo.current = null;
      });

    return () => {
      vivo = false;
    };
    // construirCuerpo depende del borrador, que ya está resumido en la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocaRevisar, claveComprobante, revision]);

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
  const pasosStepper = pasos.map((p, i) => {
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
    const proximo = pasos[indiceActual + 1];
    if (proximo) {
      setPasoActual(proximo.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function atras() {
    const previo = pasos[indiceActual - 1];
    if (previo) {
      setPasoActual(previo.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }


  async function timbrar() {
    setErrorEnvio(null);
    setIntentados(pasos.map((p) => p.id));

    if (!todoValido) {
      toast("Todavía faltan datos", "danger");
      return;
    }

    if (rechazadoPorSat) {
      toast("El SAT rechazaría este comprobante", "danger");
      return;
    }

    const cuerpo = construirCuerpo();
    if (!cuerpo) return;

    setEnviando(true);
    // Bloqueante: timbrar consume un folio y un timbre ante el SAT. Un segundo
    // clic no es una molestia, es una factura duplicada que hay que cancelar.
    // La pantalla completa existe para que ese clic no sea posible.
    const terminarProgreso = progreso("Timbrando ante el SAT…", true);
    try {
      const res = await fetch("/api/facturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
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
      terminarProgreso();
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

          {pasoActual === "pagos" && <PasoPagos {...comun} autoUuid={origenUuid} />}

          {pasoActual === "revision" && (
            <PasoRevision
              borrador={borrador}
              emisores={emisores}
              receptorActual={receptorActual}
              problemasTotales={pasos.map((p) => ({
                paso: p.id,
                titulo: p.titulo,
                problemas: problemas[p.id],
              }))}
              onIrA={irA}
            />
          )}

          {/* Revisión contra las reglas del SAT, hecha sobre el XML ya armado y
              sellado. Es distinta de `problemas`, que mira el borrador: aquí se
              cazan los rechazos que solo se ven con el comprobante hecho. */}
          {pasoActual === "revision" && todoValido && (
            <RevisionSat
              revisando={revisandoSat}
              hayResultado={datosRevision !== null}
              errores={erroresSat}
              advertencias={advertenciasSat}
              motivoFallo={falloRevision}
              onReintentar={reintentarRevision}
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
                  disabled={
                    enviando || !todoValido || sinTimbres || rechazadoPorSat || revisandoSat
                  }
                >
                  {enviando ? "Timbrando…" : revisandoSat ? "Revisando…" : "Timbrar factura"}
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
              {borrador.tipo === "P" ? (
                <Linea
                  etiqueta="Factura a pagar"
                  valor={
                    borrador.pago.facturaOrigen
                      ? borrador.pago.facturaOrigen.serie
                        ? `${borrador.pago.facturaOrigen.serie}-${borrador.pago.facturaOrigen.folio}`
                        : borrador.pago.facturaOrigen.folio
                      : "—"
                  }
                  mono
                />
              ) : (
                <Linea etiqueta="Conceptos" valor={String(borrador.conceptos.length)} />
              )}

              <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
                <span className="text-[12.5px] font-semibold text-ink">
                  {borrador.tipo === "P" ? "Monto pagado" : "Total"}
                </span>
                <span className="font-mono text-lg font-bold tracking-tight text-ink">
                  {borrador.tipo === "P"
                    ? money(borrador.pago.monto || "0", borrador.pago.monedaP)
                    : money(totales.total)}
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
                    {pasos.filter((p) => problemas[p.id].length > 0).map((p) => (
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
