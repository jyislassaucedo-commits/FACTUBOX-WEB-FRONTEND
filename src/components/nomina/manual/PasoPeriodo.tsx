"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Input, Note, Segmented, Select, useToast } from "@/components/ui";
import { PERIODICIDADES_CORRIBLES, PERIODICIDAD_EXTRAORDINARIA, proponerPeriodo } from "@/lib/nominaShared";
import {
  FORMATOS_ANTIGUEDAD,
  antiguedad,
  conceptosDesdePropuesta,
  diasEntre,
  mensajeDe,
  tieneConceptos,
  type AntiguedadFormato,
  type NominaManualForm,
  type ProblemaManual,
  type PropuestaRecibo,
} from "@/lib/nominaManualShared";
import type { Empleado } from "@/lib/empleados";
import type { Serie } from "@/lib/series";
import { Campo } from "./campos";

/**
 * Las fechas del recibo, la serie y —si se quiere— un punto de partida.
 *
 * "Proponer desde su ficha" pide al motor de la corrida el caso base del
 * empleado (sueldo por días, ISR y subsidio) y lo vuelca a los conceptos. Es
 * la mitad del trabajo de un recibo normal, y es justo la mitad que nadie
 * quiere teclear ni sabe calcular de memoria. Lo que salga se edita.
 */
export function PasoPeriodo({
  rfc,
  form,
  set,
  empleado,
  series,
  problemas,
  mostrarErrores,
}: {
  rfc: string;
  form: NominaManualForm;
  set: (cambio: Partial<NominaManualForm>) => void;
  empleado: Empleado | null;
  series: Serie[];
  problemas: ProblemaManual[];
  mostrarErrores: boolean;
}) {
  const toast = useToast();
  const [proponiendo, setProponiendo] = useState(false);
  const [confirmarReemplazo, setConfirmarReemplazo] = useState(false);
  const [avisosPropuesta, setAvisosPropuesta] = useState<string[]>([]);
  const p = form.periodo;
  const err = (campo: string) => (mostrarErrores ? mensajeDe(problemas, campo) : null);
  const extraordinaria = p.tipoNomina === "E";
  const contratoConAntiguedad = !!empleado && empleado.TipoContrato >= "01" && empleado.TipoContrato <= "08";

  function setPeriodo(cambio: Partial<NominaManualForm["periodo"]>) {
    set({ periodo: { ...p, ...cambio } });
  }

  function cambiarFechas(cambio: Partial<NominaManualForm["periodo"]>) {
    const nuevo = { ...p, ...cambio };
    // Los días se recalculan solos al mover las fechas; después se pueden
    // corregir a mano (una quincena de febrero paga 13 o 14).
    const dias = diasEntre(nuevo.fechaInicialPago, nuevo.fechaFinalPago);
    set({ periodo: { ...nuevo, diasPagados: dias || nuevo.diasPagados } });
  }

  function cambiarPeriodicidad(clave: string) {
    const prop = proponerPeriodo(clave);
    set({
      periodo: {
        ...p,
        periodicidad: clave,
        fechaInicialPago: prop.inicio,
        fechaFinalPago: prop.fin,
        fechaPago: prop.pago,
        diasPagados: prop.dias,
      },
    });
  }

  function cambiarTipo(tipo: "O" | "E") {
    setPeriodo({ tipoNomina: tipo, periodicidad: tipo === "E" ? PERIODICIDAD_EXTRAORDINARIA : p.periodicidad === PERIODICIDAD_EXTRAORDINARIA ? "" : p.periodicidad });
  }

  async function proponer() {
    if (!empleado) {
      toast("Primero elige al empleado", "danger");
      return;
    }
    setConfirmarReemplazo(false);
    setProponiendo(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/manual/proponer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEmpleado: empleado.Id, periodo: p }),
      });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo proponer el recibo", "danger");
        return;
      }
      const propuesta = body.propuesta as PropuestaRecibo;
      const renglones = conceptosDesdePropuesta(propuesta);
      set({ ...renglones, jubilacion: null, separacion: null });
      setAvisosPropuesta(propuesta.Avisos ?? []);
      toast(`${propuesta.Conceptos.length} renglones propuestos. Revísalos en Conceptos.`);
    } catch {
      toast("No se pudo conectar con el servidor", "danger");
    } finally {
      setProponiendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Periodo" description="Lo que ampara este recibo y cuándo se paga." />
        <CardBody className="space-y-4">
          <Segmented<"O" | "E">
            ariaLabel="Tipo de nómina"
            value={p.tipoNomina}
            onChange={cambiarTipo}
            options={[
              { value: "O", label: "Ordinaria" },
              { value: "E", label: "Extraordinaria (aguinaldo, finiquito)" },
            ]}
          />
          {extraordinaria && (
            <Note tone="info">
              En una extraordinaria el SAT exige periodicidad 99 y no aplica el subsidio al empleo. Los días
              pagados suelen ser los del concepto que se paga (por ejemplo, 15 de aguinaldo).
            </Note>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Periodicidad" error={err("periodo.periodicidad")}>
              <Select
                value={extraordinaria ? PERIODICIDAD_EXTRAORDINARIA : p.periodicidad}
                onChange={(e) => cambiarPeriodicidad(e.target.value)}
                disabled={extraordinaria}
              >
                <option value="">Selecciona…</option>
                {PERIODICIDADES_CORRIBLES.map((o) => (
                  <option key={o.clave} value={o.clave}>{o.clave} - {o.label}</option>
                ))}
              </Select>
            </Campo>
            <Campo label="Serie" error={err("serie")} hint="Solo series de tipo Nómina.">
              <Select value={form.serie} onChange={(e) => set({ serie: e.target.value })}>
                <option value="">Selecciona…</option>
                {series.map((s) => (
                  <option key={s.Nombre} value={s.Nombre}>{s.Nombre}</option>
                ))}
              </Select>
            </Campo>
          </div>
          {series.length === 0 && (
            <Note tone="warn">
              No hay series de tipo Nómina. Crea una en{" "}
              <Link href={`/emisores/${encodeURIComponent(rfc)}/series`} className="font-semibold underline">
                Series y folios
              </Link>
              .
            </Note>
          )}

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Campo label="Del" error={err("periodo.fechaInicialPago")}>
              <Input type="date" value={p.fechaInicialPago} onChange={(e) => cambiarFechas({ fechaInicialPago: e.target.value })} />
            </Campo>
            <Campo label="Al" error={err("periodo.fechaFinalPago")}>
              <Input type="date" value={p.fechaFinalPago} onChange={(e) => cambiarFechas({ fechaFinalPago: e.target.value })} />
            </Campo>
            <Campo label="Se paga el" error={err("periodo.fechaPago")} hint="Decide la tarifa y la UMA.">
              <Input type="date" value={p.fechaPago} onChange={(e) => setPeriodo({ fechaPago: e.target.value })} />
            </Campo>
            <Campo label="Días pagados" error={err("periodo.diasPagados")}>
              <Input type="number" step="0.001" min="0" value={p.diasPagados} onChange={(e) => setPeriodo({ diasPagados: e.target.value })} />
            </Campo>
          </div>

          {contratoConAntiguedad && empleado && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Antigüedad" hint="Cómo se declara en el recibo.">
                <Select
                  value={form.antiguedadFormato}
                  onChange={(e) => set({ antiguedadFormato: e.target.value as AntiguedadFormato })}
                >
                  {FORMATOS_ANTIGUEDAD.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Campo>
              <div className="flex flex-col justify-end pb-1 text-[12.5px] text-ink-2">
                {form.antiguedadFormato === "NINGUNA" ? (
                  <span className="text-ink-3">No se manda.</span>
                ) : (
                  <span>
                    Al cierre del periodo:{" "}
                    <span className="font-mono font-semibold text-ink">
                      {antiguedad(empleado.FechaInicioRelLaboral ?? "", p.fechaFinalPago, form.antiguedadFormato) ?? "—"}
                    </span>
                  </span>
                )}
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Punto de partida"
          description="Deja que el motor de la corrida arme el caso base con la ficha y luego corrige lo que haga falta."
          action={
            confirmarReemplazo ? (
              <span className="flex items-center gap-2">
                <span className="text-[12px] text-warn">Ya hay renglones capturados.</span>
                <Button variant="danger" size="sm" onClick={proponer} disabled={proponiendo}>
                  Reemplazarlos
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmarReemplazo(false)}>
                  Cancelar
                </Button>
              </span>
            ) : (
              <Button
                variant="secondary"
                disabled={proponiendo || !empleado}
                onClick={() => (tieneConceptos(form) ? setConfirmarReemplazo(true) : proponer())}
              >
                {proponiendo ? "Calculando…" : "Proponer desde su ficha"}
              </Button>
            )
          }
        />
        <CardBody className="space-y-2 text-[12.5px] text-ink-2">
          <p>
            Se calcula el sueldo por los días del periodo con el salario diario de la ficha
            {empleado?.SalarioDiario ? ` (${empleado.SalarioDiario})` : ""}, su ISR con la tarifa de la
            periodicidad y el subsidio al empleo que le toque. No se guarda nada: solo llena los conceptos.
          </p>
          {!empleado?.SalarioDiario && empleado && (
            <Note tone="warn">
              {empleado.Nombre} no tiene salario diario en su ficha, así que no hay con qué proponer el sueldo.
              Captura los renglones a mano o completa la ficha.
            </Note>
          )}
          {avisosPropuesta.length > 0 && (
            <Note tone="info" title="Detalles de la propuesta">
              <ul className="mt-1 space-y-1">
                {avisosPropuesta.map((a, i) => (
                  <li key={i}>· {a}</li>
                ))}
              </ul>
            </Note>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
