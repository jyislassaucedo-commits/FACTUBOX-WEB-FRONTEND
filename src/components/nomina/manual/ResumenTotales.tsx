"use client";

import { Card, CardBody, Pill } from "@/components/ui";
import { cx } from "@/components/ui/styles";
import { pesos } from "@/lib/nominaShared";
import {
  PASOS_MANUAL,
  llevaSubsidioAutomatico,
  totalesDe,
  type NominaManualForm,
  type PasoManualId,
  type ProblemaManual,
} from "@/lib/nominaManualShared";
import type { Empleado } from "@/lib/empleados";

/**
 * El neto en vivo, con la misma aritmética que va a usar el servidor.
 *
 * Pegado a la derecha mientras se captura, para que quien teclea un renglón
 * vea de inmediato qué le hace al recibo. El desglose de abajo es lo que el
 * SAT va a ver como totales del complemento: si TotalSueldos no cuadra con lo
 * que se esperaba, es aquí donde se nota antes de gastar el timbre.
 */
export function ResumenTotales({
  form,
  empleado,
  problemas,
  pasoActual,
  onIrA,
}: {
  form: NominaManualForm;
  empleado: Empleado | null;
  problemas: ProblemaManual[];
  pasoActual: PasoManualId;
  onIrA: (paso: PasoManualId) => void;
}) {
  const t = totalesDe(form, empleado);
  const porPaso = PASOS_MANUAL.map((p) => ({ ...p, n: problemas.filter((x) => x.paso === p.id).length }));
  const todoValido = problemas.length === 0;

  return (
    <Card>
      <CardBody className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Recibo</span>
          <Pill tone={form.periodo.tipoNomina === "E" ? "violet" : "neutral"}>
            {form.periodo.tipoNomina === "E" ? "Extraordinaria" : "Ordinaria"}
          </Pill>
        </div>

        <Linea etiqueta="Empleado" valor={empleado?.Nombre ?? "—"} />
        <Linea
          etiqueta="Periodo"
          valor={
            form.periodo.fechaInicialPago && form.periodo.fechaFinalPago
              ? `${form.periodo.fechaInicialPago} al ${form.periodo.fechaFinalPago}`
              : "—"
          }
          mono
        />

        <div className="space-y-1 border-t border-line pt-3">
          <Linea etiqueta="Percepciones" valor={pesos(t.percepciones)} mono />
          {t.otrosPagos > 0 && <Linea etiqueta="+ Otros pagos" valor={pesos(t.otrosPagos)} mono />}
          <Linea etiqueta="− Deducciones" valor={pesos(t.deducciones)} mono />
        </div>

        <div className="flex items-baseline justify-between gap-3 border-t border-line pt-3">
          <span className="text-[12.5px] font-semibold text-ink">Le llega</span>
          <span className="font-mono text-lg font-bold tracking-tight text-ink">{pesos(t.neto)}</span>
        </div>

        <details className="border-t border-line pt-3">
          <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            Cómo lo va a ver el SAT
          </summary>
          <div className="mt-2 space-y-1">
            <Linea etiqueta="TotalSueldos" valor={pesos(t.sueldos)} mono />
            {t.sepIndem > 0 && <Linea etiqueta="TotalSeparacionIndemnizacion" valor={pesos(t.sepIndem)} mono />}
            {t.jubPenRet > 0 && <Linea etiqueta="TotalJubilacionPensionRetiro" valor={pesos(t.jubPenRet)} mono />}
            <Linea etiqueta="TotalGravado" valor={pesos(t.gravado)} mono />
            <Linea etiqueta="TotalExento" valor={pesos(t.exento)} mono />
            {t.isr > 0 && <Linea etiqueta="ISR retenido" valor={pesos(t.isr)} mono />}
            {t.otrasDeducciones > 0 && <Linea etiqueta="Otras deducciones" valor={pesos(t.otrasDeducciones)} mono />}
            {t.subsidioEntregado > 0 && <Linea etiqueta="Subsidio entregado" valor={pesos(t.subsidioEntregado)} mono />}
            <Linea etiqueta="SubTotal" valor={pesos(t.subTotal)} mono />
            <Linea etiqueta="Descuento" valor={pesos(t.descuento)} mono />
            {llevaSubsidioAutomatico(form, empleado) && (
              <p className="pt-1 text-[11.5px] leading-relaxed text-ink-3">
                Se agregará solo el otro pago 002 (subsidio) en cero: el régimen {empleado?.TipoRegimen}{" "}
                lo lleva siempre.
              </p>
            )}
          </div>
        </details>

        <div className="border-t border-line pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
            {todoValido ? "Listo para timbrar" : "Lo que falta"}
          </p>
          {todoValido ? (
            <p className="text-[12.5px] text-ok">Todos los datos están completos.</p>
          ) : (
            <ul className="space-y-1.5">
              {porPaso.filter((p) => p.n > 0).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => onIrA(p.id)}
                    className={cx(
                      "focus-brand flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2",
                      pasoActual === p.id && "bg-surface-2"
                    )}
                  >
                    <span className="text-[12.5px] font-medium text-ink-2">{p.titulo}</span>
                    <span className="rounded-full bg-warn-bg px-2 py-0.5 text-[11px] font-semibold text-warn">
                      {p.n}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

function Linea({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="min-w-0 truncate text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className={cx("shrink-0 text-right text-[12.5px] font-semibold text-ink", mono && "font-mono")}>
        {valor}
      </span>
    </div>
  );
}
