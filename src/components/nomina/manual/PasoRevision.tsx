"use client";

import { Card, CardBody, CardHeader, Note, Pill, Table, Td, Th } from "@/components/ui";
import { etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import {
  PASOS_MANUAL,
  conceptosDe,
  totalesDe,
  type NominaManualForm,
  type PasoManualId,
  type ProblemaManual,
} from "@/lib/nominaManualShared";
import type { Empleado } from "@/lib/empleados";

/**
 * Todo el recibo de una mirada antes de gastar el timbre: a quién, por qué
 * periodo, renglón por renglón y cómo sale el neto. Es la última oportunidad
 * de notar que el sueldo se capturó en la fila equivocada.
 */
export function PasoRevision({
  form,
  empleado,
  problemas,
  onIrA,
}: {
  form: NominaManualForm;
  empleado: Empleado | null;
  problemas: ProblemaManual[];
  onIrA: (paso: PasoManualId) => void;
}) {
  const t = totalesDe(form, empleado);
  const conceptos = conceptosDe(form, empleado);
  const de = (grupo: string) => conceptos.filter((c) => c.grupo === grupo);
  const importe = (c: (typeof conceptos)[number]) => (Number(c.importe_gravado) || 0) + (Number(c.importe_exento) || 0);
  const pendientes = PASOS_MANUAL.map((p) => ({ ...p, n: problemas.filter((x) => x.paso === p.id).length })).filter((p) => p.n > 0);

  return (
    <div className="space-y-4">
      {pendientes.length > 0 && (
        <Note tone="warn" title="Todavía falta información">
          <ul className="mt-1 space-y-1">
            {pendientes.map((p) => (
              <li key={p.id}>
                ·{" "}
                <button type="button" onClick={() => onIrA(p.id)} className="font-semibold underline underline-offset-2">
                  {p.titulo}
                </button>
                : {p.n} {p.n === 1 ? "dato" : "datos"} por completar
              </li>
            ))}
          </ul>
        </Note>
      )}

      <Card>
        <CardHeader
          title={empleado?.Nombre ?? "Sin empleado"}
          description={empleado ? `${empleado.Rfc}${empleado.NumEmpleado ? ` · #${empleado.NumEmpleado}` : ""}` : undefined}
          action={
            <Pill tone={form.periodo.tipoNomina === "E" ? "violet" : "neutral"}>
              {form.periodo.tipoNomina === "E" ? "Extraordinaria" : "Ordinaria"}
            </Pill>
          }
        />
        <CardBody className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Periodo", valor: `${form.periodo.fechaInicialPago || "—"} al ${form.periodo.fechaFinalPago || "—"}` },
            { label: "Se paga", valor: form.periodo.fechaPago || "—" },
            { label: "Días", valor: form.periodo.diasPagados || "—" },
            { label: "Periodicidad", valor: form.periodo.tipoNomina === "E" ? "99 · Otra" : etiquetaPeriodicidad(form.periodo.periodicidad) },
            { label: "Serie", valor: form.serie || "—" },
            { label: "Neto", valor: pesos(t.neto) },
          ].map((k) => (
            <div key={k.label}>
              <p className="text-[11px] uppercase tracking-wide text-ink-3">{k.label}</p>
              <p className="mt-0.5 text-[14px] font-bold text-ink">{k.valor}</p>
            </div>
          ))}
        </CardBody>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Bloque titulo="Percepciones" total={t.percepciones} filas={de("PERCEPCION").map((c) => ({
          clave: c.tipo, concepto: c.concepto, importe: importe(c),
          nota: Number(c.importe_exento) > 0 ? `${pesos(c.importe_gravado)} gravado · ${pesos(c.importe_exento)} exento` : undefined,
        }))} />
        <div className="space-y-4">
          <Bloque titulo="Deducciones" total={t.deducciones} filas={de("DEDUCCION").map((c) => ({ clave: c.tipo, concepto: c.concepto, importe: importe(c) }))} />
          <Bloque titulo="Otros pagos" total={t.otrosPagos} filas={de("OTRO_PAGO").map((c) => ({ clave: c.tipo, concepto: c.concepto, importe: importe(c) }))} />
        </div>
      </div>

      {(form.incapacidades.length > 0 || form.subcontratacion.length > 0 || form.relacionados) && (
        <Card>
          <CardHeader title="Extras" />
          <CardBody className="space-y-2 text-[12.5px] text-ink-2">
            {form.incapacidades.map((i) => (
              <p key={i.id}>· Incapacidad tipo {i.tipoIncapacidad}, {i.dias} días, {pesos(i.importeMonetario || 0)}</p>
            ))}
            {form.subcontratacion.map((s) => (
              <p key={s.id}>· Subcontratación en <span className="font-mono">{s.rfcLabora}</span> al {s.porcentajeTiempo}%</p>
            ))}
            {form.relacionados && (
              <p>· Relación {form.relacionados.tipoRelacion} con {form.relacionados.uuids.length} CFDI: <span className="font-mono">{form.relacionados.uuids.join(", ")}</span></p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function Bloque({
  titulo,
  total,
  filas,
}: {
  titulo: string;
  total: number;
  filas: Array<{ clave: string; concepto: string; importe: number; nota?: string }>;
}) {
  return (
    <Card>
      <CardHeader title={titulo} action={<span className="font-mono text-[13px] font-semibold text-ink">{pesos(total)}</span>} />
      {filas.length === 0 ? (
        <CardBody className="text-[12.5px] text-ink-3">Nada.</CardBody>
      ) : (
        <Table>
          <thead>
            <tr>
              <Th className="w-14">Clave</Th>
              <Th>Concepto</Th>
              <Th className="text-right">Importe</Th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f, i) => (
              <tr key={i}>
                <Td className="font-mono text-[11.5px] text-ink-3">{f.clave}</Td>
                <Td className="text-[12.5px]">
                  {f.concepto}
                  {f.nota && <span className="block text-[11px] text-ink-3">{f.nota}</span>}
                </Td>
                <Td className="text-right font-mono text-[12.5px]">{pesos(f.importe)}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Card>
  );
}
