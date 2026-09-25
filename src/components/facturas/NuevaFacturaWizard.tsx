"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import Link from "next/link";
import { Button, Card, CardBody, Note, Segmented, buttonClass, cx, useToast } from "@/components/ui";
import { FORMAS_PAGO } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import {
  MESES,
  PERIODICIDADES,
  TIPOS_RELACION,
  TIPOS_RELACION_FACTURA,
  borradorPara,
  calcularTotales,
  llevaGlobal,
  pasosPara,
  receptorDe,
  validar,
  type FacturaBorrador,
  type ModoCaptura,
  type PasoId,
} from "@/lib/facturaNueva";
import { activos } from "@/lib/complementos";
import { ResultadoTimbrado, RevisionSat } from "./PasosNuevaFactura";
import { PasoPagos, type EditorAbierto } from "./nueva/pagos/PasoPagos";
import { olvidarPorPagar } from "./nueva/pagos/SelectorFacturasPago";
import { ResultadoComplementos, RevisionComplementos, type Emitido } from "./nueva/pagos/RevisionComplementos";
import { aPagosInput, complementosPorReceptor, totalEnPesos } from "@/lib/pagosCaptura";
import {
  PasoComplementos,
  PasoConceptos,
  PasoEmisor,
  PasoFormaPago,
  PasoOrigen,
  PasoReceptor,
  PasoRelacion,
  PasoRevision,
  type FilaResumen,
} from "./nueva/Pasos";
import { IconoTipo, MenuTipos } from "./nueva/MenuTipos";
import {
  PasoCpFiguras,
  PasoCpGeneral,
  PasoCpMercancias,
  PasoCpTransporte,
  PasoCpUbicaciones,
} from "./nueva/cartaPorte/PasosCartaPorte";
import { conceptosTraslado, nodoCartaPorte } from "@/lib/cartaPorte/construirJson";
import { claveLocal, totalesCartaPorte } from "@/lib/cartaPorte/borrador";
import type { PrefacturaAbierta } from "@/lib/cartaPorte/leerJson";
import { nombreMedio } from "@/lib/cartaPorteShared";
import { RielPasos, type EstadoPaso, type PasoRiel } from "./nueva/RielPasos";
import { DocumentoPreview } from "./nueva/DocumentoPreview";
import { ElegirModo } from "./ElegirModo";
import { RelacionarFacturaModal } from "./RelacionarFacturaModal";
import { ReceptorFormModal } from "@/components/receptores/ReceptorFormModal";
import type { Emisor } from "@/lib/emisores";
import type { Receptor } from "@/lib/receptores";
import type { Serie } from "@/lib/series";
import type { TimbrarResult, TipoComprobante, ValidarResult } from "@/lib/timbrado";
import type { CuerpoFactura as CuerpoTimbrado } from "@/lib/facturaEntrada";
import { TIMBRES_BAJOS, type Timbres } from "@/lib/timbresShared";

/*
   Nueva factura: primero el menú "¿Qué quieres hacer?" y luego, según el tipo,
   sus pasos cortos (una pregunta por pantalla) con el riel a la izquierda y el
   comprobante armándose a la derecha. Es la propuesta D que el usuario aprobó
   en el mockup.
*/

/**
 * Lo que devolvió la última revisión contra el SAT, junto con la `clave` del
 * comprobante que se revisó. Si el borrador cambia, la clave deja de coincidir
 * y el resultado se descarta solo: un visto bueno viejo no debe amparar una
 * factura distinta.
 *
 * `motivo` es distinto de "el comprobante está mal": significa que no se pudo
 * revisar. Ese caso no bloquea el timbrado.
 */
type ResultadoRevision =
  | { clave: string; datos: ValidarResult }
  | { clave: string; motivo: string };

const NOMBRE_TIPO: Record<TipoComprobante, string> = {
  I: "Factura",
  E: "Nota de crédito",
  P: "Complemento de pago",
  T: "Carta porte de traslado",
};

const TIMBRADO_TIPO: Record<TipoComprobante, string> = {
  I: "Factura timbrada",
  E: "Nota de crédito timbrada",
  P: "Complemento de pago timbrado",
  T: "Carta porte timbrada",
};

/**
 * Revisa contra el SAT cada comprobante, uno tras otro, y junta lo que
 * encuentre. Con varios (un complemento por receptor), cada hallazgo dice de
 * cuál es. Pasa solo si pasan todos.
 */
async function revisarTodos(
  cuerpos: Array<{ etiqueta: string; cuerpo: CuerpoTimbrado }>
): Promise<{ datos: ValidarResult } | { motivo: string }> {
  const junto: ValidarResult = { Valido: "1", Validacion: { Errores: [], Advertencias: [], NoRevisado: [] } };
  const varios = cuerpos.length > 1;
  for (const { etiqueta, cuerpo } of cuerpos) {
    const res = await fetch("/api/facturas/validar", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cuerpo),
    });
    const body = await res.json();
    if (!res.ok) return { motivo: `${varios ? `${etiqueta}: ` : ""}${body.error ?? "No se pudo revisar"}` };
    const datos = body as ValidarResult;
    const de = (h: { campo: string; mensaje: string }) =>
      varios ? { ...h, mensaje: `${etiqueta}: ${h.mensaje}` } : h;
    if (datos.Valido !== "1") junto.Valido = "0";
    junto.Validacion.Errores.push(...datos.Validacion.Errores.map(de));
    junto.Validacion.Advertencias.push(...datos.Validacion.Advertencias.map(de));
    for (const n of datos.Validacion.NoRevisado) {
      if (!junto.Validacion.NoRevisado.includes(n)) junto.Validacion.NoRevisado.push(n);
    }
  }
  return { datos: junto };
}

export function NuevaFacturaWizard({
  emisores,
  timbres,
  origenRfc,
  origenUuid,
  tipoInicial,
  modoInicial,
  claves,
  abierta,
}: {
  emisores: Emisor[];
  timbres: Timbres | null;
  /** Vienen de "Pagar factura" en el detalle: entran directo al complemento de pago. */
  origenRfc?: string;
  origenUuid?: string;
  /** Atajos del menú de Facturas: entran directo a un tipo, sin pasar por el menú. */
  tipoInicial?: TipoComprobante;
  modoInicial?: ModoCaptura;
  /** Claves aleatorias del primer borrador, generadas en el servidor para que la hidratación coincida. */
  claves?: { uuidLocal: string; idCCP: string };
  /** Una prefactura de la nube abierta (o duplicada) desde /facturas/prefacturas. */
  abierta?: PrefacturaAbierta;
}) {
  const toast = useToast();

  const emisorOrigenValido = origenRfc && emisores.some((e) => e.Rfc === origenRfc);
  const tipoDeEntrada: TipoComprobante | null =
    emisorOrigenValido && origenUuid ? "P" : (tipoInicial ?? null);

  const [borrador, setBorrador] = useState<FacturaBorrador>(() => {
    if (abierta) return abierta.borrador;
    const inicial = borradorPara(tipoDeEntrada ?? "I", {
      rfcEmisor: emisorOrigenValido ? origenRfc! : (emisores[0]?.Rfc ?? ""),
    });
    return inicial.cartaPorte && claves
      ? { ...inicial, cartaPorte: { ...inicial.cartaPorte, idCCP: claves.idCCP } }
      : inicial;
  });
  /** Sin tipo decidido se empieza en el menú; con atajo, directo al primer paso. */
  const [enMenu, setEnMenu] = useState(!abierta && tipoDeEntrada === null && modoInicial !== "plantilla");
  const [modo, setModo] = useState<ModoCaptura>(modoInicial ?? "una");
  const [pasoActual, setPasoActual] = useState<PasoId>("emisor");
  /** Pasos que el usuario ya dejó atrás: el riel los pinta en verde o con "!". */
  // Una prefactura abierta ya tiene sus pasos llenos: el riel deja ir a cualquiera.
  const [visitados, setVisitados] = useState<PasoId[]>(() =>
    abierta ? pasosPara(abierta.borrador.tipo, abierta.borrador.cartaPorte !== null).map((p) => p.id).filter((id) => id !== "revision") : []
  );
  /** Pasos donde intentó avanzar: solo ahí se señalan los errores junto al campo. */
  const [intentados, setIntentados] = useState<PasoId[]>([]);
  /** En pantallas medianas el comprobante se abre con un botón. */
  const [docAbierto, setDocAbierto] = useState(false);
  /** El pago que se está armando en el paso "Pagos". "Pagar factura" entra con la factura ya elegida. */
  const [editorPago, setEditorPago] = useState<EditorAbierto | null>(
    tipoDeEntrada === "P" && origenUuid ? { id: null, preseleccion: [origenUuid] } : null
  );

  /* ---------- Series, receptores y folio (igual que antes) --------------- */
  // Se cachean junto con la "clave" de la consulta que los produjo: derivar el
  // estado de carga comparando claves evita un setState síncrono dentro del
  // efecto, que la regla react-hooks/set-state-in-effect rechaza.
  const claveSeries = `${borrador.rfcEmisor}|${borrador.tipo}`;
  const [cacheSeries, setCacheSeries] = useState<{ clave: string; series: Serie[] } | null>(null);
  const series = useMemo(
    () => (cacheSeries?.clave === claveSeries ? cacheSeries.series : []),
    [cacheSeries, claveSeries]
  );
  const cargandoSeries = Boolean(borrador.rfcEmisor) && cacheSeries?.clave !== claveSeries;

  const [cacheReceptores, setCacheReceptores] = useState<{ clave: string; receptores: Receptor[] } | null>(null);
  const receptores = useMemo(
    () => (cacheReceptores?.clave === borrador.rfcEmisor ? cacheReceptores.receptores : []),
    [cacheReceptores, borrador.rfcEmisor]
  );
  const cargandoReceptores = Boolean(borrador.rfcEmisor) && cacheReceptores?.clave !== borrador.rfcEmisor;

  const [modalRelacion, setModalRelacion] = useState(false);
  const [modalReceptor, setModalReceptor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const progreso = useProgresoManual();
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  /** Lo timbrado: uno por comprobante (varios si el complemento se parte por receptor). */
  const [emitidos, setEmitidos] = useState<Emitido[] | null>(null);
  const [revision, setRevision] = useState<ResultadoRevision | null>(null);
  const revisionEnVuelo = useRef<string | null>(null);

  /* ---------- Prefactura en la nube ---------------------------------------
     El comprobante se guarda en PREFACTURA al cambiar de paso (y con el botón
     "Guardar"), como las prefacturas del escritorio: el mismo JSON del CFDI.
     Se reconoce por uuidLocal; nunca van dos guardados a la vez y no se manda
     si no cambió nada desde el último. */
  const [uuidLocal, setUuidLocal] = useState(() => abierta?.uuidLocal ?? claves?.uuidLocal ?? claveLocal());
  const [nube, setNube] = useState<{ estado: "guardando" | "guardada" | "error"; hora?: string; mensaje?: string; id?: number } | null>(
    abierta?.id ? { estado: "guardada", id: abierta.id, hora: abierta.guardada } : null
  );
  const [avisosPrefactura, setAvisosPrefactura] = useState<string[]>(abierta?.avisos ?? []);
  const ultimaGuardada = useRef<string | null>(null);
  const guardandoNube = useRef(false);

  function set(cambios: Partial<FacturaBorrador>) {
    setBorrador((prev) => ({ ...prev, ...cambios }));
  }

  useEffect(() => {
    if (!borrador.rfcEmisor) return;
    let vivo = true;
    fetch(`/api/empresas/${encodeURIComponent(borrador.rfcEmisor)}/series`)
      .then((res) => res.json())
      .then((body) => {
        if (!vivo) return;
        const delTipo: Serie[] = (body.series ?? []).filter((s: Serie) => s.Tipo === borrador.tipo);
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

  useEffect(() => {
    if (!borrador.rfcEmisor) return;
    let vivo = true;
    const clave = borrador.rfcEmisor;
    fetch(`/api/empresas/${encodeURIComponent(clave)}/receptores`)
      .then((res) => res.json())
      .then((body) => vivo && setCacheReceptores({ clave, receptores: body.receptores ?? [] }));
    return () => {
      vivo = false;
    };
  }, [borrador.rfcEmisor]);

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
        const siguiente = ultimo > 0 ? ultimo + 1 : parseInt(serieInfo?.Inicio ?? "1", 10) || 1;
        setBorrador((prev) => ({ ...prev, folio: String(siguiente) }));
      });
    return () => {
      vivo = false;
    };
  }, [borrador.rfcEmisor, borrador.serie, series]);

  /* ---------- Validación en vivo ----------------------------------------- */
  const ctx = useMemo(() => ({ emisores, series, receptores }), [emisores, series, receptores]);
  const problemas = useMemo(() => {
    const p = validar(borrador, ctx);
    // Un pago a medio armar no cuenta: hay que guardarlo o cancelarlo.
    if (editorPago) p.pagos = [...p.pagos, { campo: "editor", mensaje: "Guarda o cancela el pago que estás armando." }];
    return p;
  }, [borrador, ctx, editorPago]);
  const receptorActual = useMemo(() => receptorDe(borrador, ctx), [borrador, ctx]);
  const emisorActual = emisores.find((e) => e.Rfc === borrador.rfcEmisor) ?? null;

  const conCartaPorte = borrador.cartaPorte !== null;
  const pasos = pasosPara(borrador.tipo, conCartaPorte);
  const indiceActual = Math.max(0, pasos.findIndex((p) => p.id === pasoActual));
  const paso = pasos[indiceActual];
  const problemasPendientes = pasos.flatMap((p) => problemas[p.id]);
  const todoValido = problemasPendientes.length === 0;
  const problemasPaso = problemas[paso.id];

  /**
   * Los cuerpos que esperan /api/facturas y /api/facturas/validar. Son los
   * mismos para los dos a propósito: la revisión tiene que mirar exactamente
   * lo que se va a timbrar. Uno por comprobante: el complemento de pago se
   * parte en uno por receptor, con folios seguidos.
   */
  function construirCuerpos(): Array<{ clave: string; etiqueta: string; cuerpo: CuerpoTimbrado }> | null {
    if (!emisorActual) return null;
    const b = borrador;

    // El <input type="datetime-local"> entrega "YYYY-MM-DDTHH:mm"; el SAT
    // espera segundos.
    const conSegundos = (f: string) => (f.length === 16 ? `${f}:00` : f);
    const relaciona = b.tipo === "E" || b.relacionar;

    const comun = {
      tipoDeComprobante: b.tipo,
      cfdiRelacionados: relaciona && b.relacion.uuids.length > 0 ? b.relacion : undefined,
      emisorToken: emisorActual.Token,
      rfcEmisor: emisorActual.Rfc,
      nombreEmisor: emisorActual.Nombre,
      regimenEmisor: emisorActual.Regimen,
      lugarExpedicion: emisorActual.LugarExp,
      serie: b.serie,
      folio: b.folio,
      observaciones: b.observaciones.trim() || undefined,
      cartaPorte: b.cartaPorte ? nodoCartaPorte(b.cartaPorte) : undefined,
    };

    if (b.tipo === "T") {
      if (!b.cartaPorte) return null;
      return [
        {
          clave: emisorActual.Rfc,
          etiqueta: emisorActual.Nombre,
          cuerpo: {
            ...comun,
            formaPago: "",
            metodoPago: "",
            receptorRfc: emisorActual.Rfc,
            receptorNombre: emisorActual.Nombre,
            receptorRegimenFiscal: emisorActual.Regimen,
            receptorDomicilioFiscal: emisorActual.LugarExp,
            receptorUsoCfdi: "S01",
            conceptos: [],
            conceptosTraslado: conceptosTraslado(b.cartaPorte),
            fecha: !b.fechaActual && b.fechaEmision ? conSegundos(b.fechaEmision) : undefined,
            exportacion: b.exportacion,
          },
        },
      ];
    }

    if (b.tipo === "P") {
      const comps = complementosPorReceptor(b.captura);
      if (comps.length === 0) return null;
      const base = parseInt(b.folio, 10);
      return comps.map((comp, i) => ({
        clave: comp.receptor.rfc,
        etiqueta: comp.receptor.nombre,
        cuerpo: {
          ...comun,
          folio: Number.isFinite(base) ? String(base + i) : b.folio,
          formaPago: "",
          metodoPago: "",
          receptorRfc: comp.receptor.rfc,
          receptorNombre: comp.receptor.nombre,
          receptorRegimenFiscal: comp.receptor.regimen,
          receptorDomicilioFiscal: comp.receptor.cp,
          receptorUsoCfdi: "CP01",
          conceptos: [],
          pagos: aPagosInput(b.captura, comp.pagos),
        },
      }));
    }

    if (!receptorActual) return null;
    return [
      {
        clave: receptorActual.Rfc,
        etiqueta: receptorActual.Nombre,
        cuerpo: {
          ...comun,
          formaPago: b.formaPago,
          metodoPago: b.metodoPago,
          condicionesDePago: b.condicionesDePago.trim() || undefined,
          receptorRfc: receptorActual.Rfc,
          receptorNombre: receptorActual.Nombre,
          receptorRegimenFiscal: receptorActual.RegimenFiscal,
          receptorDomicilioFiscal: receptorActual.DomicilioFiscal,
          receptorUsoCfdi: b.usoCfdi,
          conceptos: b.conceptos,
          fecha: !b.fechaActual && b.fechaEmision ? conSegundos(b.fechaEmision) : undefined,
          moneda: b.moneda,
          tipoCambio: b.moneda !== "MXN" ? b.tipoCambio : undefined,
          exportacion: b.exportacion,
          informacionGlobal: llevaGlobal(b) ? b.global : undefined,
          complementos: b.tipo === "I" && activos(b.complementos).length > 0 ? b.complementos : undefined,
        },
      },
    ];
  }

  /* ---------- Revisión contra el SAT ------------------------------------ */
  const claveComprobante = useMemo(
    () => {
      const cuerpos = construirCuerpos();
      return cuerpos === null ? null : JSON.stringify(cuerpos);
    },
    // Depende de todo lo que arma el comprobante.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [borrador, emisores, receptorActual]
  );
  const enPlantilla = modo === "plantilla";
  const tocaRevisar = !enMenu && !enPlantilla && pasoActual === "revision" && todoValido && claveComprobante !== null;
  const revisionVigente = revision !== null && revision.clave === claveComprobante ? revision : null;
  const datosRevision = revisionVigente !== null && "datos" in revisionVigente ? revisionVigente.datos : null;
  const falloRevision = revisionVigente !== null && "motivo" in revisionVigente ? revisionVigente.motivo : null;
  const revisandoSat = tocaRevisar && revisionVigente === null;
  const erroresSat = datosRevision?.Validacion.Errores ?? [];
  const advertenciasSat = datosRevision?.Validacion.Advertencias ?? [];
  const noRevisadoSat = datosRevision?.Validacion.NoRevisado ?? [];
  const rechazadoPorSat = datosRevision !== null && datosRevision.Valido === "0";

  // Al llegar al último paso se revisa sola: si el usuario tuviera que pedirlo,
  // la mayoría timbraría sin hacerlo y el timbre se perdería igual.
  useEffect(() => {
    if (!tocaRevisar || claveComprobante === null) return;
    if (revision !== null && revision.clave === claveComprobante) return;
    if (revisionEnVuelo.current === claveComprobante) return;

    const cuerpos = construirCuerpos();
    if (cuerpos === null) return;
    const clave = claveComprobante;
    revisionEnVuelo.current = clave;
    let vivo = true;

    revisarTodos(cuerpos)
      .then((r) => ({ clave, ...r }))
      .catch(() => ({ clave, motivo: "No se pudo conectar con el servidor" }))
      .then((r) => vivo && setRevision(r))
      .finally(() => {
        if (revisionEnVuelo.current === clave) revisionEnVuelo.current = null;
      });

    return () => {
      vivo = false;
    };
    // construirCuerpos depende del borrador, que ya está resumido en la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocaRevisar, claveComprobante, revision]);

  /** Más de esto y el guardado automático se apaga: serían megas en cada paso. */
  const MERCANCIAS_AUTOGUARDADO = 500;

  async function guardarNube(manual = false) {
    if (borrador.tipo === "P") return; // el complemento de pago tiene su propio flujo
    const cuerpos = construirCuerpos();
    if (!cuerpos || cuerpos.length === 0) {
      if (manual) toast("Para guardar hace falta el emisor y el receptor", "danger");
      return;
    }
    if (!manual && (borrador.cartaPorte?.mercancias.length ?? 0) > MERCANCIAS_AUTOGUARDADO) return;
    const clave = JSON.stringify(cuerpos[0].cuerpo);
    if (!manual && clave === ultimaGuardada.current) return;
    if (guardandoNube.current) return;
    guardandoNube.current = true;
    setNube((prev) => ({ ...prev, estado: "guardando" }));
    try {
      const res = await fetch("/api/prefacturas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfcEmisor: borrador.rfcEmisor, uuidLocal, cuerpo: cuerpos[0].cuerpo }),
      });
      const body = await res.json();
      if (!res.ok) {
        setNube((prev) => ({ ...prev, estado: "error", mensaje: body.error ?? "No se pudo guardar" }));
        if (manual) toast(body.error ?? "No se pudo guardar en la nube", "danger");
        return;
      }
      ultimaGuardada.current = clave;
      setNube({ estado: "guardada", id: body.id, hora: new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) });
      if (manual) toast("Guardada en la nube");
    } catch {
      setNube((prev) => ({ ...prev, estado: "error", mensaje: "No se pudo conectar con el servidor" }));
    } finally {
      guardandoNube.current = false;
    }
  }

  function reintentarRevision() {
    revisionEnVuelo.current = null;
    setRevision(null);
  }

  const sinTimbres = timbres !== null && timbres.disponibles <= 0;
  const pocosTimbres = timbres !== null && timbres.disponibles > 0 && timbres.disponibles <= TIMBRES_BAJOS;

  /* ---------- Riel y navegación ------------------------------------------ */
  const visitado = (id: PasoId) => visitados.includes(id);

  function estadoDe(id: PasoId): EstadoPaso {
    if (id === pasoActual) return "actual";
    if (!visitado(id) && !intentados.includes(id)) return "pendiente";
    return problemas[id].length > 0 ? "falta" : "hecho";
  }

  const totales = calcularTotales(borrador.conceptos, borrador.complementos);

  /** Lo elegido en cada paso, en corto (riel) y en largo (revisión). */
  function resumenDe(id: PasoId): { valor: string; detalle?: string } {
    const b = borrador;
    switch (id) {
      case "emisor":
        return {
          valor: emisorActual?.Nombre ?? "Sin emisor",
          detalle: [
            b.serie && b.folio ? `Serie ${b.serie}, folio ${b.folio}` : "Sin serie",
            b.tipo !== "P" && (b.fechaActual ? "fecha de hoy" : b.fechaEmision.replace("T", " ")),
            b.tipo !== "P" && b.tipo !== "T" && b.moneda +(b.moneda !== "MXN" ? ` a ${b.tipoCambio || "—"}` : ""),
            b.tipo !== "P" && `exportación ${b.exportacion}`,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      case "receptor": {
        const g = llevaGlobal(b)
          ? `Global ${PERIODICIDADES.find((p) => p.value === b.global.periodicidad)?.label.slice(5) ?? ""}, ${MESES.find((m) => m.value === b.global.meses)?.label.slice(5) ?? "sin mes"} ${b.global.anio}`
          : undefined;
        return {
          valor: receptorActual?.Nombre ?? "Sin receptor",
          detalle: [receptorActual?.Rfc, `uso ${b.usoCfdi}`, g].filter(Boolean).join(" · "),
        };
      }
      case "conceptos":
        return {
          valor: money(totales.total, b.moneda),
          detalle: `${b.conceptos.length} concepto${b.conceptos.length === 1 ? "" : "s"}`,
        };
      case "pago":
        return {
          valor: b.metodoPago,
          detalle: FORMAS_PAGO.find((f) => f.value === b.formaPago)?.label,
        };
      case "relacion":
        return b.relacionar
          ? {
              valor: `${b.relacion.uuids.length} relacionada${b.relacion.uuids.length === 1 ? "" : "s"}`,
              detalle: TIPOS_RELACION_FACTURA.find((t) => t.value === b.relacion.tipoRelacion)?.label,
            }
          : { valor: "No se relaciona" };
      case "complementos": {
        const lista = activos(b.complementos);
        return {
          valor: lista.length
            ? lista.map((c) => c.nombre).join(", ")
            : b.cartaPorte
              ? "Solo la carta porte"
              : "Ninguno",
        };
      }
      case "origen":
        return {
          valor: `${b.relacion.uuids.length} factura${b.relacion.uuids.length === 1 ? "" : "s"}`,
          detalle: TIPOS_RELACION.find((t) => t.value === b.relacion.tipoRelacion)?.label,
        };
      case "pagos": {
        const n = b.captura.pagos.length;
        if (n === 0) return { valor: "Sin pagos" };
        const comps = complementosPorReceptor(b.captura);
        const facturas = new Set(b.captura.pagos.flatMap((p) => p.docs.map((d) => d.uuid))).size;
        return {
          valor: `${n} pago${n === 1 ? "" : "s"} · ${money(totalEnPesos(b.captura.pagos))}`,
          detalle: [
            `${facturas} factura${facturas === 1 ? "" : "s"}`,
            comps.length > 1 ? `${comps.length} receptores, ${comps.length} complementos` : comps[0]?.receptor.nombre,
          ]
            .filter(Boolean)
            .join(" · "),
        };
      }
      case "cpGeneral": {
        const cp = b.cartaPorte;
        if (!cp) return { valor: "" };
        return {
          valor: nombreMedio(cp.medio),
          detalle: [cp.transpInternac === "Sí" ? `internacional, ${cp.entradaSalidaMerc.toLowerCase() || "sin sentido"}` : "nacional", `peso en ${cp.unidadPeso}`].join(" · "),
        };
      }
      case "cpTransporte":
        return { valor: b.cartaPorte?.transporte?.alias || "Sin transporte" };
      case "cpFiguras": {
        const f = b.cartaPorte?.figuras ?? [];
        return { valor: f.length ? f.map((x) => x.nombre).join(", ") : "Sin figuras" };
      }
      case "cpUbicaciones": {
        const cp = b.cartaPorte;
        const u = cp?.ubicaciones ?? [];
        if (!cp || u.length === 0) return { valor: "Sin ubicaciones" };
        const km = totalesCartaPorte(cp).distancia;
        return { valor: u.map((x) => x.nombreremdest).join(" → "), detalle: km > 0 ? `${km.toLocaleString("es-MX")} km` : undefined };
      }
      case "cpMercancias": {
        const cp = b.cartaPorte;
        if (!cp || cp.mercancias.length === 0) return { valor: "Sin mercancías" };
        const t = totalesCartaPorte(cp);
        return {
          valor: `${t.numMercancias.toLocaleString("es-MX")} mercancía${t.numMercancias === 1 ? "" : "s"}`,
          detalle: `${t.pesoBruto.toLocaleString("es-MX", { maximumFractionDigits: 3 })} ${cp.unidadPeso}`,
        };
      }
      default:
        return { valor: "" };
    }
  }

  const pasosRiel: PasoRiel[] = pasos.map((p, i) => {
    const estado = estadoDe(p.id);
    const faltan = problemas[p.id].length;
    return {
      id: p.id,
      titulo: p.titulo,
      estado,
      resumen:
        estado === "falta"
          ? `${faltan} dato${faltan === 1 ? "" : "s"} pendiente${faltan === 1 ? "" : "s"}`
          : estado === "hecho" && p.id !== "revision"
            ? resumenDe(p.id).valor
            : undefined,
      habilitado: i <= indiceActual || visitado(p.id) || (i > 0 && visitado(pasos[i - 1].id)),
    };
  });

  function irA(id: PasoId) {
    // Salir de "Pagos" con el editor abierto tiraría el pago a medio armar.
    // Solo ahí: "Pagar factura" entra con el pago ya preparado desde el paso
    // del emisor, y antes este aviso impedía siquiera llegar a verlo.
    if (editorPago && pasoActual === "pagos" && id !== pasoActual) {
      toast("Guarda o cancela el pago que estás armando: sus botones están al pie del pago", "danger");
      document
        .querySelector('section[aria-label="Nuevo pago"], section[aria-label="Editar pago"]')
        ?.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }
    setVisitados((prev) => (prev.includes(pasoActual) ? prev : [...prev, pasoActual]));
    void guardarNube();
    setPasoActual(id);
    setDocAbierto(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function siguiente() {
    setIntentados((prev) => (prev.includes(pasoActual) ? prev : [...prev, pasoActual]));
    if (problemasPaso.length > 0) {
      toast("Faltan datos en este paso", "danger");
      return;
    }
    const proximo = pasos[indiceActual + 1];
    if (proximo) irA(proximo.id);
  }

  function atras() {
    if (indiceActual === 0) {
      volverAlMenu();
      return;
    }
    irA(pasos[indiceActual - 1].id);
  }

  function nuevaPrefactura() {
    setUuidLocal(claveLocal());
    setNube(null);
    ultimaGuardada.current = null;
  }

  function empezar(tipo: TipoComprobante, cartaPorte = false) {
    nuevaPrefactura();
    setBorrador((prev) => borradorPara(tipo, { rfcEmisor: prev.rfcEmisor }, cartaPorte));
    setModo("una");
    setEnMenu(false);
    setPasoActual("emisor");
    setVisitados([]);
    setIntentados([]);
    setErrorEnvio(null);
    setEditorPago(null);
    window.scrollTo({ top: 0 });
  }

  function volverAlMenu() {
    setEnMenu(true);
    setModo("una");
    setErrorEnvio(null);
    setEditorPago(null);
    window.scrollTo({ top: 0 });
  }

  /** El folio que sigue en la serie, pedido justo antes de timbrar para no chocar. */
  async function folioSiguiente(): Promise<string> {
    const serieInfo = series.find((s) => s.Nombre === borrador.serie);
    const res = await fetch(
      `/api/facturas/folio?rfc=${encodeURIComponent(borrador.rfcEmisor)}&serie=${encodeURIComponent(borrador.serie)}`
    );
    const body = await res.json();
    const ultimo = body.ultimoFolio ?? 0;
    return String(ultimo > 0 ? ultimo + 1 : parseInt(serieInfo?.Inicio ?? "1", 10) || 1);
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
    const cuerpos = construirCuerpos();
    if (!cuerpos) return;

    setEnviando(true);
    // Bloqueante: timbrar consume un folio y un timbre ante el SAT. Un segundo
    // clic no es una molestia, es una factura duplicada que hay que cancelar.
    const terminarProgreso = progreso(
      cuerpos.length > 1 ? `Timbrando ${cuerpos.length} complementos ante el SAT…` : "Timbrando ante el SAT…",
      true
    );
    // Los que ya se timbraron en un intento anterior no se repiten.
    const lista: Emitido[] = cuerpos.map(
      ({ clave, etiqueta }) =>
        emitidos?.find((e) => e.clave === clave && e.ok) ?? { clave, etiqueta, folio: "" }
    );
    try {
      for (let i = 0; i < cuerpos.length; i++) {
        if (lista[i].ok) continue;
        try {
          // Con varios complementos, cada uno pide su folio justo antes: el
          // anterior ya ocupó el que se veía en pantalla.
          const folio = borrador.tipo === "P" ? await folioSiguiente() : cuerpos[i].cuerpo.folio;
          const res = await fetch("/api/facturas", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...cuerpos[i].cuerpo, folio }),
          });
          const body = await res.json();
          lista[i] = res.ok
            ? { ...lista[i], folio, ok: body as TimbrarResult, error: undefined }
            : { ...lista[i], folio, error: body.error ?? "No se pudo timbrar el comprobante" };
        } catch {
          lista[i] = { ...lista[i], error: "No se pudo conectar con el servidor" };
        }
      }
    } finally {
      terminarProgreso();
      setEnviando(false);
    }

    const bien = lista.filter((e) => e.ok).length;
    // Un complemento cambia saldos y una factura PPD nueva entra a la lista.
    if (bien > 0) olvidarPorPagar();
    if (bien === 0) {
      // Nada se timbró: se queda en la revisión para corregir.
      setErrorEnvio(
        lista.length > 1 ? lista.map((e) => `${e.etiqueta}: ${e.error}`).join(" · ") : (lista[0].error ?? null)
      );
      // El motivo queda abajo del resumen, fuera de la vista: sin esto parecía
      // que el botón no había hecho nada.
      toast("No se timbró: el SAT lo rechazó. Abajo está el motivo", "danger");
      requestAnimationFrame(() =>
        document.getElementById("error-timbrado")?.scrollIntoView({ behavior: "smooth", block: "center" })
      );
      return;
    }
    setEmitidos(lista);
    // Ya timbrada, la prefactura sobra (el escritorio hace lo mismo).
    if (nube?.id) void fetch(`/api/prefacturas/${nube.id}?rfc=${encodeURIComponent(borrador.rfcEmisor)}`, { method: "DELETE" });
    toast(
      bien === lista.length
        ? lista.length > 1
          ? `${bien} complementos timbrados`
          : TIMBRADO_TIPO[borrador.tipo]
        : `Se timbraron ${bien} de ${lista.length}`,
      bien === lista.length ? undefined : "danger"
    );
  }

  function otroComprobante() {
    nuevaPrefactura();
    setEmitidos(null);
    setErrorEnvio(null);
    setVisitados([]);
    setIntentados([]);
    setPasoActual("emisor");
    setEditorPago(null);
    setBorrador((prev) => borradorPara(prev.tipo, { rfcEmisor: prev.rfcEmisor }, prev.cartaPorte !== null));
    setEnMenu(true);
  }

  /* ---------- Pantallas ---------------------------------------------------- */

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

  if (emitidos) {
    const unico = emitidos.length === 1 ? emitidos[0].ok : undefined;
    return unico ? (
      <ResultadoTimbrado
        titulo={TIMBRADO_TIPO[borrador.tipo]}
        uuid={unico.UUID}
        fechaTimbrado={unico.FechaTimbrado}
        onOtra={otroComprobante}
      />
    ) : (
      <ResultadoComplementos
        serie={borrador.serie}
        emitidos={emitidos}
        enviando={enviando}
        onReintentar={timbrar}
        onOtra={otroComprobante}
      />
    );
  }

  if (enMenu) {
    return (
      <MenuTipos
        onElegir={empezar}
        onPlantilla={() => {
          setModo("plantilla");
          setEnMenu(false);
        }}
      />
    );
  }

  if (enPlantilla) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Button variant="ghost" onClick={volverAlMenu}>
          ← Volver a “¿Qué quieres hacer?”
        </Button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[13px] font-semibold text-ink-2">Plantilla de</span>
          <Segmented<TipoComprobante>
            ariaLabel="Qué plantilla"
            value={borrador.tipo === "P" ? "P" : "I"}
            onChange={(t) => set({ tipo: t, serie: "", folio: "" })}
            options={[
              { value: "I", label: "Facturas" },
              { value: "P", label: "Complementos de pago" },
            ]}
          />
        </div>
        <ElegirModo
          modo={modo}
          onModo={(m) => (m === "una" ? empezar(borrador.tipo) : setModo(m))}
          tipo={borrador.tipo}
          rfcEmisor={borrador.rfcEmisor}
        />
      </div>
    );
  }

  const comun = {
    borrador,
    set,
    problemas: problemasPaso,
    mostrarErrores: intentados.includes(pasoActual),
  };

  const filasRevision: FilaResumen[] = pasos
    .filter((p) => p.id !== "revision")
    .map((p) => ({ paso: p.id, etiqueta: p.titulo, ...resumenDe(p.id) }));

  const titulos = Object.fromEntries(pasos.map((p) => [p.id, p.titulo])) as Partial<Record<PasoId, string>>;
  const esRevision = pasoActual === "revision";

  const documento = (
    <DocumentoPreview
      borrador={borrador}
      emisor={emisorActual}
      receptor={receptorActual}
      pasoActual={pasoActual}
      visto={visitado}
      titulos={titulos}
      editandoPago={editorPago !== null}
    />
  );

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_380px]">
      <RielPasos
        tipo={borrador.tipo === "I" && conCartaPorte ? "Factura con carta porte" : NOMBRE_TIPO[borrador.tipo]}
        folio={borrador.serie && borrador.folio ? `${borrador.serie}-${borrador.folio}` : "Sin folio todavía"}
        icono={<IconoTipo tipo={borrador.tipo} />}
        pasos={pasosRiel}
        onIr={irA}
      />

      <div className="min-w-0 space-y-4">
        {avisosPrefactura.length > 0 && (
          <Note tone="warn" title="Revisa esta prefactura antes de timbrar">
            <ul className="mt-1 list-disc space-y-0.5 pl-4">
              {avisosPrefactura.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <button type="button" onClick={() => setAvisosPrefactura([])} className="focus-brand mt-1.5 rounded text-[12px] font-medium underline">
              Entendido
            </button>
          </Note>
        )}
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <p className="text-[12px] text-ink-3">
                Paso {indiceActual + 1} de {pasos.length}
              </p>
              <h1 className="text-balance text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink">
                {paso.pregunta}
              </h1>
              <p className="text-pretty text-[14px] text-ink-2">{paso.porque}</p>
            </div>

            {pasoActual === "emisor" && (
              <PasoEmisor {...comun} emisores={emisores} series={series} cargandoSeries={cargandoSeries} />
            )}
            {pasoActual === "origen" && <PasoOrigen {...comun} onAbrirRelacion={() => setModalRelacion(true)} />}
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
            {pasoActual === "pago" && <PasoFormaPago {...comun} />}
            {pasoActual === "relacion" && (
              <PasoRelacion {...comun} onAbrirRelacion={() => setModalRelacion(true)} />
            )}
            {pasoActual === "complementos" && <PasoComplementos {...comun} />}
            {pasoActual === "pagos" && <PasoPagos {...comun} editor={editorPago} onEditor={setEditorPago} />}
            {conCartaPorte && pasoActual === "cpGeneral" && <PasoCpGeneral {...comun} />}
            {conCartaPorte && pasoActual === "cpTransporte" && <PasoCpTransporte {...comun} />}
            {conCartaPorte && pasoActual === "cpFiguras" && <PasoCpFiguras {...comun} />}
            {conCartaPorte && pasoActual === "cpUbicaciones" && <PasoCpUbicaciones {...comun} />}
            {conCartaPorte && pasoActual === "cpMercancias" && <PasoCpMercancias {...comun} />}
            {esRevision && borrador.tipo === "P" && (
              <RevisionComplementos
                borrador={borrador}
                set={set}
                mostrarErrores={intentados.includes("revision")}
              />
            )}
            {esRevision && (
              <PasoRevision
                {...comun}
                pasos={pasos}
                problemasPorPaso={problemas}
                filas={filasRevision}
                onIrA={irA}
              />
            )}
          </CardBody>
        </Card>

        {/* Revisión contra las reglas del SAT, hecha sobre el XML ya armado y
            sellado: caza lo que solo se ve con el comprobante hecho. */}
        {esRevision && todoValido && (
          <RevisionSat
            revisando={revisandoSat}
            hayResultado={datosRevision !== null}
            errores={erroresSat}
            advertencias={advertenciasSat}
            noRevisado={noRevisadoSat}
            motivoFallo={falloRevision}
            onReintentar={reintentarRevision}
          />
        )}
        {esRevision && sinTimbres && (
          <Note tone="danger" title="No te quedan timbres">
            El timbrado consume un timbre de tu cuenta y tu saldo está en cero. Recarga con tu distribuidor antes de
            emitir.
          </Note>
        )}
        {esRevision && pocosTimbres && (
          <Note tone="warn" title={`Te quedan ${timbres!.disponibles} timbres`}>
            Este comprobante consumirá uno. Conviene recargar pronto.
          </Note>
        )}
        {errorEnvio && (
          <div id="error-timbrado">
            <Note tone="danger" title="El SAT rechazó el comprobante">
              {errorEnvio}
            </Note>
          </div>
        )}

        {/* En pantallas donde no cabe la tercera columna, el comprobante se abre aquí. */}
        <div className="xl:hidden">
          <Button variant="secondary" onClick={() => setDocAbierto((v) => !v)} aria-expanded={docAbierto}>
            {docAbierto ? "Ocultar el comprobante" : "Ver cómo va el comprobante"}
          </Button>
          {docAbierto && <div className="mt-3">{documento}</div>}
        </div>

        {/* ---------- Navegación ----------
            Mientras se arma un pago, el editor trae sus propios botones. */}
        <div hidden={editorPago !== null && pasoActual === "pagos"} className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 px-4 py-3 shadow-raised backdrop-blur">
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={atras}>
              {indiceActual === 0 ? "Cambiar tipo" : "Atrás"}
            </Button>
            {borrador.tipo !== "P" && (
              <span className="flex items-center gap-2 text-[12px] text-ink-3">
                {nube?.estado === "guardando"
                  ? "Guardando en la nube…"
                  : nube?.estado === "error"
                    ? <span className="text-warn" title={nube.mensaje}>No se guardó en la nube</span>
                    : nube?.hora
                      ? `Guardada en la nube ${nube.hora}`
                      : "Sin guardar"}
                <Button size="sm" variant="ghost" onClick={() => void guardarNube(true)} disabled={nube?.estado === "guardando"}>
                  Guardar
                </Button>
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            {intentados.includes(pasoActual) && problemasPaso.length > 0 && (
              <span className="text-[12px] font-medium text-warn">
                {problemasPaso.length} dato{problemasPaso.length === 1 ? "" : "s"} por completar
              </span>
            )}
            {esRevision ? (
              <Button
                variant="primary"
                onClick={timbrar}
                disabled={enviando || !todoValido || sinTimbres || rechazadoPorSat || revisandoSat}
              >
                {enviando
                  ? "Timbrando…"
                  : revisandoSat
                    ? "Revisando…"
                    : `Timbrar ${NOMBRE_TIPO[borrador.tipo].toLowerCase()}`}
              </Button>
            ) : (
              <Button variant="primary" onClick={siguiente}>
                Continuar
              </Button>
            )}
          </div>
        </div>
      </div>

      <aside className={cx("hidden xl:sticky xl:top-20 xl:block")}>{documento}</aside>

      {modalRelacion && (
        <RelacionarFacturaModal
          titulo={
            borrador.tipo === "E"
              ? "Relacionar la factura que corrige"
              : borrador.tipo === "P"
                ? "Complemento cancelado que sustituye"
                : "Relacionar facturas"
          }
          tipo={borrador.tipo === "P" ? "P" : "I"}
          rfcEmisor={borrador.rfcEmisor}
          yaRelacionados={borrador.relacion.uuids}
          onClose={() => setModalRelacion(false)}
          onAgregar={(uuids) =>
            set({
              relacion: {
                ...borrador.relacion,
                uuids: [...borrador.relacion.uuids, ...uuids.filter((u) => !borrador.relacion.uuids.includes(u))],
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
            setCacheReceptores((prev) => (prev ? { ...prev, receptores: [...prev.receptores, receptor] } : prev));
            set({ receptorRfc: receptor.Rfc, usoCfdi: receptor.UsoCfdi || borrador.usoCfdi });
            toast("Receptor agregado");
          }}
        />
      )}
    </div>
  );
}
