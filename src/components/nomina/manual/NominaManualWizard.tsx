"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Note, Pill, Stepper, useToast, type PasoEstado } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import { RevisionSat } from "@/components/facturas/PasosNuevaFactura";
import { fechaHora } from "@/lib/cfdi";
import { etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import {
  FORM_VACIO,
  PASOS_MANUAL,
  normalizarForm,
  validarManual,
  type NominaManualForm,
  type PasoManualId,
  type ProblemaManual,
} from "@/lib/nominaManualShared";
import type { ValidarResult } from "@/lib/timbrado";
import type { ResultadoNominaManual } from "@/lib/nominaManual";
import type { Empleado } from "@/lib/empleados";
import type { Serie } from "@/lib/series";
import { PasoEmpleado } from "./PasoEmpleado";
import { PasoPeriodo } from "./PasoPeriodo";
import { PasoConceptos } from "./PasoConceptos";
import { PasoExtras } from "./PasoExtras";
import { PasoRevision } from "./PasoRevision";
import { ResumenTotales } from "./ResumenTotales";
import { GuardarPrenominaModal } from "./GuardarPrenominaModal";

/**
 * El asistente de nómina manual: el recibo capturado renglón por renglón,
 * como lo hace el escritorio, con la validación en vivo y el neto a la vista.
 *
 * Se puede abrir vacío, desde una prenómina guardada (para editarla o
 * timbrarla otra vez) o como copia de una (sin id: al guardar crea otra).
 *
 * La revisión ante el SAT y el timbrado son los mismos que los de la corrida
 * y las facturas: el backend arma el CFDI, `apiTimbradoV2` lo valida o lo
 * timbra, y si venía de una prenómina se le anota el resultado.
 */
type ResultadoRevision = { clave: string; datos: ValidarResult } | { clave: string; motivo: string };

export function NominaManualWizard({
  rfc,
  emisorToken,
  empleados,
  series,
  registroPatronalEmpresa,
  inicial,
  pasoInicial,
}: {
  rfc: string;
  emisorToken: string;
  /** Con las bajas incluidas: el finiquito es el caso de uso principal. */
  empleados: Empleado[];
  /** Solo las de tipo N. */
  series: Serie[];
  registroPatronalEmpresa: string;
  inicial?: { id?: string; nombre?: string; form: NominaManualForm; vecesTimbrada?: number; ultimoUuid?: string | null };
  pasoInicial?: PasoManualId;
}) {
  const router = useRouter();
  const toast = useToast();
  const iniciarProgreso = useProgresoManual();

  const [form, setForm] = useState<NominaManualForm>(() => {
    const base = inicial ? normalizarForm(inicial.form) : { ...FORM_VACIO };
    if (!base.serie && series.length === 1) base.serie = series[0].Nombre;
    return base;
  });
  const [idPrenomina, setIdPrenomina] = useState<string | null>(inicial?.id ?? null);
  const [nombre, setNombre] = useState(inicial?.nombre ?? "");
  const [pasoActual, setPasoActual] = useState<PasoManualId>(pasoInicial ?? (inicial?.id ? "revision" : "empleado"));
  const [intentados, setIntentados] = useState<PasoManualId[]>([]);
  const [guardando, setGuardando] = useState(false);
  const [modalNombre, setModalNombre] = useState(false);
  const [sucio, setSucio] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<ResultadoNominaManual | null>(null);
  const [erroresServidor, setErroresServidor] = useState<ProblemaManual[]>([]);
  const [revision, setRevision] = useState<ResultadoRevision | null>(null);
  const revisionEnVuelo = useRef<string | null>(null);

  const empleado = useMemo(() => empleados.find((e) => e.Id === form.idEmpleado) ?? null, [empleados, form.idEmpleado]);
  const problemas = useMemo(() => validarManual(form, empleado), [form, empleado]);
  const problemasDe = (paso: PasoManualId) => problemas.filter((p) => p.paso === paso);
  const todoValido = problemas.length === 0;
  const indiceActual = PASOS_MANUAL.findIndex((p) => p.id === pasoActual);

  function set(cambio: Partial<NominaManualForm>) {
    setForm((prev) => ({ ...prev, ...cambio }));
    setSucio(true);
    setErroresServidor([]);
  }

  function irA(paso: PasoManualId) {
    setIntentados((prev) => (prev.includes(pasoActual) ? prev : [...prev, pasoActual]));
    setPasoActual(paso);
  }

  function siguiente() {
    const siguientePaso = PASOS_MANUAL[indiceActual + 1];
    if (siguientePaso) irA(siguientePaso.id);
  }

  function atras() {
    const anterior = PASOS_MANUAL[indiceActual - 1];
    if (anterior) setPasoActual(anterior.id);
  }

  /* ---------------- Revisión ante el SAT ---------------- */

  const claveComprobante = useMemo(() => JSON.stringify(form), [form]);
  const tocaRevisar = pasoActual === "revision" && todoValido;
  const revisionVigente = revision !== null && revision.clave === claveComprobante ? revision : null;
  const datosRevision = revisionVigente !== null && "datos" in revisionVigente ? revisionVigente.datos : null;
  const falloRevision = revisionVigente !== null && "motivo" in revisionVigente ? revisionVigente.motivo : null;
  const revisandoSat = tocaRevisar && revisionVigente === null;
  const rechazadoPorSat = datosRevision !== null && datosRevision.Valido === "0";

  useEffect(() => {
    if (!tocaRevisar) return;
    if (revision !== null && revision.clave === claveComprobante) return;
    if (revisionEnVuelo.current === claveComprobante) return;

    const clave = claveComprobante;
    revisionEnVuelo.current = clave;
    let vivo = true;

    fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/manual/validar`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emisorToken, form }),
    })
      .then(async (res) => {
        const body = await res.json();
        if (res.ok) return { clave, datos: body as ValidarResult };
        if (Array.isArray(body.errores) && body.errores.length > 0 && vivo) setErroresServidor(body.errores);
        return { clave, motivo: (body.error as string) ?? "No se pudo revisar" };
      })
      .catch(() => ({ clave, motivo: "No se pudo conectar con el servidor" }))
      .then((r) => vivo && setRevision(r))
      .finally(() => {
        if (revisionEnVuelo.current === clave) revisionEnVuelo.current = null;
      });

    return () => {
      vivo = false;
    };
    // `form` ya está resumido en la clave.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tocaRevisar, claveComprobante, revision, rfc, emisorToken]);

  /* ---------------- Guardar ---------------- */

  function pedirGuardar() {
    if (nombre) void guardar(nombre);
    else setModalNombre(true);
  }

  async function guardar(nombreElegido: string) {
    setGuardando(true);
    const terminar = iniciarProgreso("Guardando prenómina…");
    try {
      const url = idPrenomina
        ? `/api/empresas/${encodeURIComponent(rfc)}/nomina/prenominas/${idPrenomina}`
        : `/api/empresas/${encodeURIComponent(rfc)}/nomina/prenominas`;
      const res = await fetch(url, {
        method: idPrenomina ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombreElegido, form }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo guardar la prenómina", "danger");
        return;
      }
      setNombre(nombreElegido);
      setIdPrenomina(String(body.id));
      setModalNombre(false);
      setSucio(false);
      const n = Array.isArray(body.errores) ? body.errores.length : 0;
      toast(n > 0 ? `Prenómina guardada con ${n} ${n === 1 ? "pendiente" : "pendientes"} para poder timbrarla` : "Prenómina guardada");
      if (!idPrenomina) {
        // La URL pasa a apuntar a la plantilla, para que recargar no la pierda.
        router.replace(`/emisores/${encodeURIComponent(rfc)}/nomina/manual?prenomina=${body.id}&paso=${pasoActual}`);
      }
    } catch {
      toast("No se pudo conectar con el servidor", "danger");
    } finally {
      terminar();
      setGuardando(false);
    }
  }

  /* ---------------- Timbrar ---------------- */

  async function timbrar() {
    setIntentados(PASOS_MANUAL.map((p) => p.id));
    if (!todoValido) {
      toast("Todavía falta información para timbrar", "danger");
      return;
    }
    setEnviando(true);
    const terminar = iniciarProgreso("Timbrando el recibo…", true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/manual/timbrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emisorToken, form, idPrenomina: idPrenomina ?? undefined }),
      });
      const body = (await res.json()) as ResultadoNominaManual & { error?: string };
      if (!res.ok) {
        toast(body.error ?? "No se pudo timbrar", "danger");
        return;
      }
      if (body.errores && body.errores.length > 0) setErroresServidor(body.errores);
      setResultado(body);
      if (body.ok) toast("Recibo timbrado");
      else toast(body.error ?? "El PAC rechazó el recibo", "danger");
    } catch {
      toast("No se pudo conectar con el servidor", "danger");
    } finally {
      terminar();
      setEnviando(false);
    }
  }

  /** Otra igual: mismo empleado y renglones, fechas en blanco. */
  function otraIgual() {
    setResultado(null);
    setRevision(null);
    setIntentados([]);
    setForm((prev) => ({
      ...prev,
      periodo: { ...prev.periodo, fechaInicialPago: "", fechaFinalPago: "", fechaPago: "" },
    }));
    setPasoActual("periodo");
  }

  /* ---------------- Render ---------------- */

  const pasosStepper = PASOS_MANUAL.map((p) => {
    const n = problemasDe(p.id).length;
    let estado: PasoEstado = "pendiente";
    if (p.id === pasoActual) estado = "actual";
    else if (n > 0 && intentados.includes(p.id)) estado = "error";
    else if (n === 0 && (intentados.includes(p.id) || PASOS_MANUAL.findIndex((x) => x.id === p.id) < indiceActual)) estado = "completo";
    return { id: p.id, titulo: p.titulo, descripcion: p.descripcion, estado, faltantes: n };
  });

  const sugerido = empleado
    ? `${empleado.Nombre.split(" ").slice(0, 2).join(" ")} · ${
        form.periodo.tipoNomina === "E" ? "extraordinaria" : etiquetaPeriodicidad(form.periodo.periodicidad).toLowerCase()
      }`
    : "";

  const comun = { form, set, empleado, mostrarErrores: intentados.includes(pasoActual) };

  if (resultado?.ok) {
    return (
      <Card className="mx-auto max-w-xl">
        <CardBody className="text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-bg text-xl text-ok" aria-hidden>
            ✓
          </span>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">Recibo timbrado</h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {resultado.nombre} · {resultado.serie}-{resultado.folio} · {pesos(resultado.neto)}
            {resultado.fechaTimbrado ? ` · ${fechaHora(resultado.fechaTimbrado)}` : ""}
          </p>
          <p className="mt-4 break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-[12px] text-ink">
            {resultado.uuid}
          </p>
          {idPrenomina && (
            <p className="mt-2 text-[12.5px] text-ink-3">
              La prenómina <span className="font-semibold text-ink">{nombre}</span> se conserva como plantilla.
            </p>
          )}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina/prenominas`} className={buttonClass("secondary")}>
              Ver prenóminas
            </Link>
            <Link href="/facturas" className={buttonClass("secondary")}>
              Ver mis facturas
            </Link>
            <Button variant="primary" onClick={otraIgual}>
              Otra igual
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <nav className="flex flex-wrap items-center justify-between gap-2 text-[12.5px] text-ink-3">
        <span>
          <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina`} className="hover:text-brand">Nómina</Link>
          <span aria-hidden> / </span>
          <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina/prenominas`} className="hover:text-brand">Prenóminas</Link>
          <span aria-hidden> / </span>
          <span className="font-medium text-ink-2">{nombre || "Nómina manual"}</span>
        </span>
        <span className="flex items-center gap-2">
          {idPrenomina && <Pill tone="brand">plantilla</Pill>}
          {inicial?.vecesTimbrada ? <Pill tone="ok">timbrada {inicial.vecesTimbrada} {inicial.vecesTimbrada === 1 ? "vez" : "veces"}</Pill> : null}
          {sucio && idPrenomina && <Pill tone="warn">cambios sin guardar</Pill>}
        </span>
      </nav>

      <Stepper pasos={pasosStepper} onIr={(id) => irA(id as PasoManualId)} />

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0 space-y-4">
          {pasoActual === "empleado" && (
            <PasoEmpleado
              rfc={rfc}
              empleados={empleados}
              idEmpleado={form.idEmpleado}
              onElegir={(id) => set({ idEmpleado: id })}
              mostrarErrores={comun.mostrarErrores}
              registroPatronalEmpresa={registroPatronalEmpresa}
            />
          )}
          {pasoActual === "periodo" && (
            <PasoPeriodo rfc={rfc} {...comun} series={series} problemas={problemasDe("periodo")} />
          )}
          {pasoActual === "conceptos" && <PasoConceptos {...comun} problemas={problemasDe("conceptos")} />}
          {pasoActual === "extras" && (
            <PasoExtras form={form} set={set} problemas={problemasDe("extras")} mostrarErrores={comun.mostrarErrores} />
          )}
          {pasoActual === "revision" && (
            <PasoRevision form={form} empleado={empleado} problemas={problemas} onIrA={irA} />
          )}

          {erroresServidor.length > 0 && (
            <Note tone="danger" title="El servidor encontró problemas en el formulario">
              <ul className="mt-1 space-y-1">
                {erroresServidor.map((e, i) => (
                  <li key={e.campo + i}>· <span className="font-mono text-[11.5px]">{e.campo}</span>: {e.mensaje}</li>
                ))}
              </ul>
            </Note>
          )}

          {pasoActual === "revision" && todoValido && (
            <RevisionSat
              revisando={revisandoSat}
              hayResultado={datosRevision !== null}
              errores={datosRevision?.Validacion.Errores ?? []}
              advertencias={datosRevision?.Validacion.Advertencias ?? []}
              noRevisado={datosRevision?.Validacion.NoRevisado ?? []}
              motivoFallo={falloRevision}
              onReintentar={() => {
                revisionEnVuelo.current = null;
                setRevision(null);
              }}
            />
          )}

          {resultado && !resultado.ok && (
            <Note tone="danger" title="No se timbró">
              {resultado.error}
              {idPrenomina && " Quedó anotado en la prenómina."}
            </Note>
          )}

          <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 px-4 py-3 shadow-raised backdrop-blur">
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={atras} disabled={indiceActual === 0 || enviando}>
                Atrás
              </Button>
              <Button variant="secondary" onClick={pedirGuardar} disabled={guardando || enviando || !form.idEmpleado}>
                {guardando ? "Guardando…" : idPrenomina ? "Guardar cambios" : "Guardar prenómina"}
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {problemasDe(pasoActual).length > 0 && (
                <span className="text-[12px] font-medium text-warn">
                  {problemasDe(pasoActual).length} dato{problemasDe(pasoActual).length === 1 ? "" : "s"} por completar
                </span>
              )}
              {pasoActual === "revision" ? (
                <Button
                  variant="primary"
                  onClick={timbrar}
                  disabled={enviando || !todoValido || rechazadoPorSat || revisandoSat}
                  title={inicial?.ultimoUuid ? `Ya se timbró antes (${inicial.ultimoUuid}). Se va a emitir otro CFDI.` : undefined}
                >
                  {enviando ? "Timbrando…" : revisandoSat ? "Revisando…" : inicial?.vecesTimbrada ? "Timbrar otra vez" : "Timbrar recibo"}
                </Button>
              ) : (
                <Button variant="primary" onClick={siguiente}>
                  Continuar
                </Button>
              )}
            </div>
          </div>
        </div>

        <aside className="xl:sticky xl:top-20">
          <ResumenTotales form={form} empleado={empleado} problemas={problemas} pasoActual={pasoActual} onIrA={irA} />
        </aside>
      </div>

      {modalNombre && (
        <GuardarPrenominaModal
          inicial={nombre}
          sugerido={sugerido}
          pendiente={guardando}
          onClose={() => setModalNombre(false)}
          onGuardar={(n) => void guardar(n)}
        />
      )}
    </div>
  );
}
