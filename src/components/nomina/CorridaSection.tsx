"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Button, Card, CardBody, CardHeader, EmptyState, Note, Pill,
  Table, Td, Th, useToast,
} from "@/components/ui";
import { dias, etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import { CorridaFormModal } from "./CorridaFormModal";
import { IncidenciasModal } from "./IncidenciasModal";
import { SelectorEmpleados } from "./SelectorEmpleados";
import { RepetirCorridaModal } from "./RepetirCorridaModal";
import { EmpleadoFormModal } from "@/components/empleados/EmpleadoFormModal";
import type { Empleado } from "@/lib/empleados";
import type { ConceptoRecibo, IncidenciaNomina, PeriodoNomina, ReciboNomina } from "@/lib/nomina";
import type { Serie } from "@/lib/series";

type Omitido = { IdEmpleado: string; Nombre: string; Motivo: string };
type AvisoCalculo = { Nombre: string; Aviso: string };

/** Lo que va pasando durante el timbrado, para pintarlo mientras corre. */
type Avance = {
  total: number;
  hechos: number;
  actual: string;
  resultados: { nombre: string; ok: boolean; uuid?: string; error?: string; folio: string }[];
};

export function CorridaSection({
  rfc,
  emisorToken,
  periodo,
  recibos,
  conceptos,
  incidencias,
  empleados,
  registroPatronal,
  series,
}: {
  rfc: string;
  emisorToken: string;
  periodo: PeriodoNomina;
  recibos: ReciboNomina[];
  /** El desglose de cada recibo, por id de recibo. */
  conceptos: Record<string, ConceptoRecibo[]>;
  /** Lo que se capturó de cada quien en este periodo, por id de empleado. */
  incidencias: Record<string, IncidenciaNomina[]>;
  /** Para poder completarle los datos a quien quedó fuera sin salir de aquí. */
  empleados: Empleado[];
  registroPatronal: string;
  /** Solo las de tipo N: un recibo de nómina no puede llevar serie de ingreso. */
  series: Serie[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [serie, setSerie] = useState(series[0]?.Nombre ?? "");
  const [calculando, setCalculando] = useState(false);
  const [omitidos, setOmitidos] = useState<Omitido[]>([]);
  const [avisos, setAvisos] = useState<AvisoCalculo[]>([]);
  const [avance, setAvance] = useState<Avance | null>(null);
  const [incidenciasDe, setIncidenciasDe] = useState<ReciboNomina | null>(null);
  /** Se enciende al capturar algo: el recibo que se ve ya no corresponde a lo
   *  capturado hasta que se vuelva a correr, y callarlo sería dejar timbrar un
   *  recibo viejo. */
  const [porRecalcular, setPorRecalcular] = useState(false);
  const [editando, setEditando] = useState(false);
  const [borrando, setBorrando] = useState(false);
  const [completando, setCompletando] = useState<Empleado | null>(null);
  const [eligiendo, setEligiendo] = useState(false);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [repitiendo, setRepitiendo] = useState(false);

  const pendientes = recibos.filter((r) => r.Estado !== "TIMBRADO");
  const timbrados = recibos.filter((r) => r.Estado === "TIMBRADO");
  const conError = recibos.filter((r) => r.Estado === "ERROR");
  const netoTotal = recibos.reduce((a, r) => a + (parseFloat(r.Neto) || 0), 0);

  async function quitar(r: ReciboNomina) {
    setQuitando(r.IdEmpleado);
    try {
      const res = await fetch(
        `/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}/candidatos?idEmpleado=${encodeURIComponent(r.IdEmpleado)}`,
        { method: "DELETE" }
      );
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo sacar de la corrida", "danger");
        return;
      }
      toast(`${r.Nombre} sale de esta corrida`);
      router.refresh();
    } finally {
      setQuitando(null);
    }
  }

  async function borrar() {
    setBorrando(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo borrar la corrida", "danger");
        return;
      }
      toast("Corrida borrada");
      router.push(`/emisores/${encodeURIComponent(rfc)}/nomina`);
    } finally {
      setBorrando(false);
    }
  }

  async function calcular(empleados?: string[]) {
    setCalculando(true);
    setEligiendo(false);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}/calcular`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(empleados ? { empleados } : {}),
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo correr la nómina", "danger");
        return;
      }
      setOmitidos(body.omitidos ?? []);
      setAvisos(body.avisos ?? []);
      setPorRecalcular(false);
      if (body.nota) toast(body.nota, "danger");
      else toast(`${(body.calculados ?? []).length} recibos calculados`);
      router.refresh();
    } finally {
      setCalculando(false);
    }
  }

  /**
   * Timbra uno por uno y va pintando el avance.
   *
   * De uno en uno y no todos de golpe: se ve por quién va, un rechazo no
   * detiene a los demás, y al final queda claro a quién hay que volver. Cada
   * recibo consume un timbre, así que no hay vuelta atrás por los que ya
   * salieron.
   */
  async function timbrar() {
    if (!serie) {
      toast("Elige la serie con la que se van a timbrar", "danger");
      return;
    }
    const cola = pendientes;
    setAvance({ total: cola.length, hechos: 0, actual: cola[0]?.Nombre ?? "", resultados: [] });

    for (let i = 0; i < cola.length; i++) {
      const r = cola[i];
      setAvance((a) => (a ? { ...a, actual: r.Nombre } : a));
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${periodo.Id}/timbrar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEmpleado: r.IdEmpleado, emisorToken, serie }),
      }).then((x) => x.json());

      setAvance((a) =>
        a
          ? {
              ...a,
              hechos: i + 1,
              resultados: [
                ...a.resultados,
                { nombre: r.Nombre, ok: res.ok === true, uuid: res.uuid, error: res.error, folio: res.folio ?? "" },
              ],
            }
          : a
      );
    }

    router.refresh();
  }

  const corriendo = avance !== null && avance.hechos < avance.total;

  return (
    <div className="space-y-4">
      <nav className="text-[12.5px] text-ink-3">
        <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina`} className="hover:text-brand">
          Nómina
        </Link>
        <span aria-hidden> / </span>
        <span className="font-medium text-ink-2">
          {periodo.FechaInicialPago} al {periodo.FechaFinalPago}
        </span>
      </nav>

      <Card>
        <CardHeader
          title={periodo.Descripcion || `${etiquetaPeriodicidad(periodo.Periodicidad)} del ${periodo.FechaInicialPago} al ${periodo.FechaFinalPago}`}
          description={`Se paga el ${periodo.FechaPago} · ${dias(periodo.DiasPagados)} días · ${periodo.TipoNomina === "O" ? "ordinaria" : "extraordinaria"}`}
          action={
            <div className="flex items-center gap-2">
              {periodo.Estado === "BORRADOR" && timbrados.length === 0 && (
                <>
                  <Button variant="ghost" onClick={() => setEditando(true)} disabled={corriendo}>
                    Editar
                  </Button>
                  <Button variant="ghost" onClick={borrar} disabled={borrando || corriendo}>
                    {borrando ? "Borrando…" : "Borrar"}
                  </Button>
                </>
              )}
              {recibos.length > 0 && periodo.TipoNomina !== "E" && (
                <Button
                  variant="ghost"
                  onClick={() => setRepitiendo(true)}
                  disabled={calculando || corriendo}
                  title="Crear la corrida del periodo siguiente con esta misma gente"
                >
                  Repetir
                </Button>
              )}
              <Button variant="secondary" onClick={() => setEligiendo(true)} disabled={calculando || corriendo}>
                {calculando ? "Calculando…" : recibos.length ? "Recalcular" : "Correr nómina"}
              </Button>
              {pendientes.length > 0 && (
                <Button variant="primary" onClick={timbrar} disabled={corriendo || calculando}>
                  {corriendo ? "Timbrando…" : `Timbrar ${pendientes.length}`}
                </Button>
              )}
            </div>
          }
        />

        <CardBody className="grid grid-cols-2 gap-3 border-b border-line-2 sm:grid-cols-4">
          {[
            { label: "Recibos", valor: String(recibos.length) },
            { label: "Timbrados", valor: String(timbrados.length) },
            { label: "Con error", valor: String(conError.length) },
            { label: "Neto total", valor: pesos(netoTotal) },
          ].map((k) => (
            <div key={k.label}>
              <p className="text-[11px] uppercase tracking-wide text-ink-3">{k.label}</p>
              <p className="mt-0.5 text-[15px] font-bold text-ink">{k.valor}</p>
            </div>
          ))}
        </CardBody>

        {pendientes.length > 0 && (
          <CardBody className="flex flex-wrap items-end gap-3 border-b border-line-2">
            <div className="min-w-[180px]">
              <label className="mb-1 block text-xs font-medium text-ink-2">Serie del recibo</label>
              <select
                className="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm"
                value={serie}
                onChange={(e) => setSerie(e.target.value)}
                disabled={corriendo}
              >
                {series.length === 0 && <option value="">Sin series de tipo Nómina</option>}
                {series.map((s) => (
                  <option key={s.Nombre} value={s.Nombre}>{s.Nombre}</option>
                ))}
              </select>
            </div>
            {series.length === 0 && (
              <p className="text-[12px] text-warn">
                Crea una serie de tipo Nómina en{" "}
                <Link href={`/emisores/${encodeURIComponent(rfc)}/series`} className="font-semibold underline">
                  Series y folios
                </Link>
                .
              </p>
            )}
          </CardBody>
        )}
      </Card>

      {/* Cuando ya no falta nada por timbrar, lo siguiente que se va a querer
          hacer es la quincena que sigue. Vale mas ofrecerlo aqui que dejar que
          se regrese a la lista a crearla de cero. */}
      {recibos.length > 0 && pendientes.length === 0 && conError.length === 0 && periodo.TipoNomina !== "E" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[13px] border border-ok/25 bg-ok/[0.06] px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-[13.3px] font-semibold text-ink">Esta corrida ya quedó</p>
            <p className="mt-0.5 text-[12.5px] leading-relaxed text-ink-2">
              Cuando toque el periodo siguiente no la vuelvas a armar: repítela y te la deja lista con los
              mismos {recibos.length} {recibos.length === 1 ? "empleado" : "empleados"} y las fechas nuevas.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setRepitiendo(true)}>
            Repetir en el periodo siguiente
          </Button>
        </div>
      )}

      {repitiendo && (
        <RepetirCorridaModal
          rfc={rfc}
          idPeriodo={String(periodo.Id)}
          onClose={() => setRepitiendo(false)}
          onCreada={(id, empleados) => {
            setRepitiendo(false);
            toast(`Corrida creada y calculada para ${empleados} empleados`);
            router.push(`/emisores/${encodeURIComponent(rfc)}/nomina/${id}`);
          }}
        />
      )}

      {avance && (
        <Card>
          <CardHeader
            title={corriendo ? `Timbrando ${avance.hechos + 1} de ${avance.total}` : "Timbrado terminado"}
            description={corriendo ? `Va en ${avance.actual}. Cada recibo consume un timbre.` : undefined}
          />
          <CardBody className="space-y-1.5">
            <div className="h-1.5 overflow-hidden rounded-full bg-line-2">
              <div
                className="h-full bg-[var(--brand)] transition-all"
                style={{ width: `${(avance.hechos / Math.max(1, avance.total)) * 100}%` }}
              />
            </div>
            {avance.resultados.map((r, i) => (
              <p key={r.nombre + i} className="text-[12.5px]">
                {r.ok ? (
                  <>
                    <span className="text-ok">✓</span> {r.nombre}{" "}
                    <span className="font-mono text-[11.5px] text-ink-3">{r.uuid}</span>
                  </>
                ) : (
                  <>
                    <span className="text-danger">✕</span> {r.nombre}{" "}
                    <span className="text-danger">{r.error}</span>
                  </>
                )}
              </p>
            ))}
          </CardBody>
        </Card>
      )}

      {omitidos.length > 0 && (
        <Note tone="warn" title={`${omitidos.length} empleados quedaron fuera de la corrida`}>
          <ul className="mt-1 space-y-1.5">
            {omitidos.map((o, i) => {
              // Casi siempre es que les falta un dato. Se completa aquí mismo:
              // mandar a otra pantalla y que vuelvan a buscar la corrida es
              // pedirles que se acuerden de dónde estaban.
              const emp = empleados.find((e) => String(e.Id) === String(o.IdEmpleado));
              return (
                <li key={o.Nombre + i} className="flex flex-wrap items-baseline gap-x-2">
                  <span>· <span className="font-medium">{o.Nombre}</span>: {o.Motivo}</span>
                  {emp && (
                    <button type="button" onClick={() => setCompletando(emp)}
                      className="font-semibold underline underline-offset-2">
                      Completar datos
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
          <p className="mt-2 opacity-80">
            ¿Falta alguien que ni siquiera aparece aquí? Dalo de alta en{" "}
            <Link href={`/emisores/${encodeURIComponent(rfc)}/empleados`} className="font-semibold underline">
              Empleados
            </Link>{" "}
            y vuelve a correr la nómina.
          </p>
        </Note>
      )}

      {avisos.length > 0 && (
        <Note tone="info" title={`${avisos.length} detalles que conviene revisar`}>
          <ul className="mt-1 space-y-1">
            {avisos.map((a, i) => (
              <li key={a.Nombre + i}>· <span className="font-medium">{a.Nombre}</span>: {a.Aviso}</li>
            ))}
          </ul>
        </Note>
      )}

      {porRecalcular && (
        <Note tone="warn" title="Hay cambios que no se han aplicado">
          Los recibos de abajo todavía son los de antes. Corre la nómina otra vez para que se
          reflejen.{" "}
          <button type="button" onClick={() => setEligiendo(true)} disabled={calculando}
            className="font-semibold underline underline-offset-2">
            {calculando ? "Recalculando…" : "Recalcular ahora"}
          </button>
        </Note>
      )}

      {periodo.TipoNomina === "E" && (
        <Note tone="info" title="Es una nómina extraordinaria">
          No paga el sueldo del periodo: solo lo que captures en cada empleado. Para un aguinaldo,
          entra a sus incidencias y agrega uno — sin días ni importe se calculan los que le tocan
          por antigüedad. Su ISR va por el artículo 174 del Reglamento, no por la tarifa del
          periodo.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Recibos"
          description="Lo que le toca cobrar a cada quien en este periodo."
          action={
            recibos.length > 0 && periodo.Estado !== "CERRADO" ? (
              // Junto a los "Quitar" de cada renglón: agregar y quitar son la
              // misma decisión en dos sentidos, y esconder una detrás de
              // "Recalcular" deja a quien quitó a alguien por error sin salida.
              <Button variant="secondary" onClick={() => setEligiendo(true)} disabled={calculando || corriendo}>
                Agregar empleados
              </Button>
            ) : undefined
          }
        />
        {recibos.length === 0 ? (
          <EmptyState
            title="Todavía no se ha corrido"
            description="Al correrla entran los empleados activos con esta periodicidad, y a cada uno se le calcula su recibo."
            action={
              <Button variant="primary" onClick={() => setEligiendo(true)} disabled={calculando}>
                {calculando ? "Calculando…" : "Correr nómina"}
              </Button>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th className="w-8" />
                <Th>Empleado</Th>
                <Th className="text-right">Días</Th>
                <Th className="text-right">Percepciones</Th>
                <Th className="text-right">ISR</Th>
                <Th className="text-right">Subsidio</Th>
                <Th className="text-right">Neto</Th>
                <Th>Estado</Th>
                <Th className="w-32">Incidencias</Th>
              </tr>
            </thead>
            <tbody>
              {recibos.map((r) => (
                <Fragment key={r.Id}>
                <tr className="transition hover:bg-surface-2">
                  <Td>
                    <button type="button" aria-label="Ver el desglose"
                      onClick={() => setAbierto(abierto === r.Id ? null : r.Id)}
                      className="text-ink-3 transition hover:text-ink">
                      {abierto === r.Id ? "▾" : "▸"}
                    </button>
                  </Td>
                  <Td>
                    <span className="block text-[13.3px] font-semibold text-ink">{r.Nombre}</span>
                    <span className="block font-mono text-[11.3px] text-ink-3">
                      {r.Rfc}{r.NumEmpleado ? ` · #${r.NumEmpleado}` : ""}
                    </span>
                  </Td>
                  <Td className="text-right text-[12.5px]">{dias(r.DiasPagados)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">{pesos(r.TotalPercepciones)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">{pesos(r.IsrRetenido)}</Td>
                  <Td className="text-right font-mono text-[12.5px]">
                    {parseFloat(r.SubsidioEntregado) > 0 ? (
                      <span className="text-ok" title="Se le entrega: su subsidio superó al ISR">
                        {pesos(r.SubsidioEntregado)}
                      </span>
                    ) : (
                      <span className="text-ink-3">—</span>
                    )}
                  </Td>
                  <Td className="text-right font-mono text-[12.5px] font-semibold">{pesos(r.Neto)}</Td>
                  <Td>
                    {r.Estado === "TIMBRADO" ? (
                      <Pill tone="ok">timbrado</Pill>
                    ) : r.Estado === "ERROR" ? (
                      <Pill tone="danger" title={r.Error ?? undefined}>error</Pill>
                    ) : (
                      <Pill tone="neutral">por timbrar</Pill>
                    )}
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    {/* Un recibo timbrado ya no admite cambios: lo que hay que
                        corregir es el CFDI ante el SAT, no la captura. */}
                    {r.Estado === "TIMBRADO" ? (
                      <span className="text-[12px] text-ink-3">
                        {(incidencias[r.IdEmpleado] ?? []).length || "—"}
                      </span>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => setIncidenciasDe(r)}
                          className="text-[12.5px] font-semibold text-brand hover:underline"
                        >
                          {(incidencias[r.IdEmpleado] ?? []).length > 0
                            ? `${(incidencias[r.IdEmpleado] ?? []).length} capturadas`
                            : "Agregar"}
                        </button>
                        {/* Sacarlo de esta corrida no lo borra ni toca sus
                            incidencias: puede que solo no le toque cobrar hoy. */}
                        <button
                          type="button"
                          onClick={() => quitar(r)}
                          disabled={quitando === r.IdEmpleado}
                          title="Sacarlo de esta corrida"
                          className="text-[12px] text-ink-3 hover:text-danger disabled:opacity-50"
                        >
                          {quitando === r.IdEmpleado ? "…" : "Quitar"}
                        </button>
                      </span>
                    )}
                  </Td>
                </tr>
                {abierto === r.Id && (
                  <tr>
                    <Td colSpan={8} className="bg-surface-2 p-0">
                      <Desglose recibo={r} conceptos={conceptos[r.Id] ?? []} />
                    </Td>
                  </tr>
                )}
                </Fragment>
              ))}
            </tbody>
          </Table>
        )}

        {conError.length > 0 && (
          <CardBody className="border-t border-line-2">
            <Note tone="danger" title={`${conError.length} recibos no se timbraron`}>
              <ul className="mt-1 space-y-1">
                {conError.map((r) => (
                  <li key={r.Id}>· <span className="font-medium">{r.Nombre}</span>: {r.Error}</li>
                ))}
              </ul>
              <p className="mt-1.5 opacity-80">
                Corrige lo que falta y vuelve a timbrar: solo se reintentan los que no salieron, los
                timbrados no se tocan.
              </p>
            </Note>
          </CardBody>
        )}
      </Card>

      {eligiendo && (
        <SelectorEmpleados
          rfc={rfc}
          idPeriodo={periodo.Id}
          periodicidad={periodo.Periodicidad}
          onClose={() => setEligiendo(false)}
          onCorrer={(ids) => calcular(ids)}
        />
      )}

      {editando && (
        <CorridaFormModal
          rfc={rfc}
          periodo={periodo}
          onClose={() => setEditando(false)}
          onCreada={() => {
            setEditando(false);
            toast("Corrida actualizada. Vuelve a correrla para aplicar las fechas nuevas.");
            setPorRecalcular(true);
            router.refresh();
          }}
        />
      )}

      {completando && (
        <EmpleadoFormModal
          rfcEmisor={rfc}
          empleado={completando}
          registroPatronalEmpresa={registroPatronal}
          onClose={() => setCompletando(null)}
          onSaved={() => {
            setCompletando(null);
            toast("Datos guardados. Vuelve a correr la nómina para incluirlo.");
            setPorRecalcular(true);
            router.refresh();
          }}
        />
      )}

      {incidenciasDe && (
        <IncidenciasModal
          rfc={rfc}
          idPeriodo={periodo.Id}
          idEmpleado={incidenciasDe.IdEmpleado}
          nombre={incidenciasDe.Nombre}
          iniciales={incidencias[incidenciasDe.IdEmpleado] ?? []}
          onClose={(huboCambios) => {
            setIncidenciasDe(null);
            if (huboCambios) {
              setPorRecalcular(true);
              router.refresh();
            }
          }}
        />
      )}
    </div>
  );
}

/**
 * El desglose de un recibo: de dónde sale el neto.
 *
 * Muestra la aritmética completa, no solo los renglones. Alguien que reclama su
 * pago no pregunta "¿cuánto?", pregunta "¿por qué ese?", y la respuesta no puede
 * ser abrir el XML.
 *
 * El ISR va aparte de las demás deducciones porque tiene su propia historia: lo
 * que la tarifa causó, lo que el subsidio cubrió, y lo que quedó por retener.
 * Solo uno de los dos últimos puede ser distinto de cero — o se le retiene o se
 * le entrega — y verlos juntos es lo que hace entendible el número.
 */
function Desglose({
  recibo,
  conceptos,
}: {
  recibo: ReciboNomina;
  conceptos: ConceptoRecibo[];
}) {
  const de = (grupo: string) => conceptos.filter((c) => c.grupo === grupo);
  const total = (c: ConceptoRecibo) =>
    parseFloat(c.importe_gravado || "0") + parseFloat(c.importe_exento || "0");

  const percepciones = de("PERCEPCION");
  const deducciones = de("DEDUCCION");
  const otrosPagos = de("OTRO_PAGO");
  const subsidioEntregado = parseFloat(recibo.SubsidioEntregado || "0");

  if (conceptos.length === 0) {
    return (
      <p className="px-5 py-4 text-[12.5px] text-ink-3">
        Sin desglose guardado. Vuelve a correr la nómina para generarlo.
      </p>
    );
  }

  return (
    <div className="grid gap-5 px-5 py-4 lg:grid-cols-2">
      <div className="space-y-4">
        <Bloque titulo="Percepciones" total={recibo.TotalPercepciones}>
          {percepciones.map((c, i) => (
            <Renglon key={c.tipo + i} clave={c.tipo} concepto={c.concepto} importe={total(c)}
              nota={
                parseFloat(c.importe_exento) > 0
                  ? parseFloat(c.importe_gravado) > 0
                    ? `${pesos(c.importe_gravado)} gravado · ${pesos(c.importe_exento)} exento`
                    : "exento"
                  : undefined
              } />
          ))}
        </Bloque>

        {otrosPagos.length > 0 && (
          <Bloque titulo="Otros pagos" total={recibo.TotalOtrosPagos}>
            {otrosPagos.map((c, i) => (
              <Renglon key={c.tipo + i} clave={c.tipo} concepto={c.concepto} importe={total(c)} />
            ))}
          </Bloque>
        )}
      </div>

      <div className="space-y-4">
        <Bloque titulo="Deducciones" total={recibo.TotalDeducciones}>
          {deducciones.map((c, i) => (
            <Renglon key={c.tipo + i} clave={c.tipo} concepto={c.concepto} importe={total(c)} />
          ))}
        </Bloque>

        <div className="rounded-xl border border-line-2 p-3.5">
          <p className="mb-2 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
            Cómo salió el ISR
          </p>
          <Linea etiqueta="Causado por la tarifa" valor={recibo.IsrCausado} />
          <Linea etiqueta="Subsidio al empleo" valor={recibo.SubsidioCausado} signo="−" />
          {subsidioEntregado > 0 ? (
            <Linea etiqueta="Se le entrega la diferencia" valor={recibo.SubsidioEntregado} fuerte
              nota="Su subsidio superó al ISR, así que no se le retiene nada." />
          ) : (
            <Linea etiqueta="Se le retiene" valor={recibo.IsrRetenido} fuerte />
          )}
        </div>

        <div className="rounded-xl border border-brand/40 bg-brand-050 p-3.5">
          <Linea etiqueta="Percepciones" valor={recibo.TotalPercepciones} />
          {parseFloat(recibo.TotalOtrosPagos || "0") > 0 && (
            <Linea etiqueta="Otros pagos" valor={recibo.TotalOtrosPagos} signo="+" />
          )}
          <Linea etiqueta="Deducciones" valor={recibo.TotalDeducciones} signo="−" />
          <div className="mt-1.5 border-t border-brand/30 pt-1.5">
            <Linea etiqueta="Le llega" valor={recibo.Neto} fuerte />
          </div>
        </div>
      </div>
    </div>
  );
}

function Bloque({
  titulo,
  total,
  children,
}: {
  titulo: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-line-2 p-3.5">
      <div className="mb-2 flex items-baseline justify-between">
        <p className="text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">{titulo}</p>
        <p className="font-mono text-[12.5px] font-semibold text-ink">{pesos(total)}</p>
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function Renglon({
  clave,
  concepto,
  importe,
  nota,
}: {
  clave: string;
  concepto: string;
  importe: number;
  nota?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className="min-w-0">
        <span className="font-mono text-[11px] text-ink-4">{clave}</span>{" "}
        <span className="text-ink-2">{concepto}</span>
        {nota && <span className="block text-[11px] text-ink-3">{nota}</span>}
      </span>
      <span className="shrink-0 font-mono text-ink">{pesos(importe)}</span>
    </div>
  );
}

function Linea({
  etiqueta,
  valor,
  signo,
  fuerte,
  nota,
}: {
  etiqueta: string;
  valor: string;
  signo?: string;
  fuerte?: boolean;
  nota?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[12.5px]">
      <span className={fuerte ? "font-semibold text-ink" : "text-ink-2"}>
        {signo ? `${signo} ` : ""}
        {etiqueta}
        {nota && <span className="block text-[11px] font-normal text-ink-3">{nota}</span>}
      </span>
      <span className={`shrink-0 font-mono ${fuerte ? "font-semibold text-ink" : "text-ink-2"}`}>
        {pesos(valor)}
      </span>
    </div>
  );
}
