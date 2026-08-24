"use client";

import { Card, CardBody, CardHeader, Table, Td, Th } from "@/components/ui";
import { money, type CfdiNomina } from "@/lib/cfdi";

const NOMBRE_TIPO_INCAPACIDAD: Record<string, string> = {
  "01": "Riesgo de trabajo",
  "02": "Enfermedad general",
  "03": "Maternidad",
  "04": "Otros",
};

/**
 * Reemplaza a "Conceptos" cuando el comprobante es un recibo de nómina: lo
 * que importa son las percepciones, deducciones y otros pagos, no un
 * concepto de relleno.
 */
export function NominaDetalle({ nomina, moneda }: { nomina: CfdiNomina; moneda: string }) {
  const p = nomina.percepciones;
  const d = nomina.deducciones;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={`Nómina ${nomina.tipoNomina === "E" ? "extraordinaria" : "ordinaria"}`}
          description={`Periodo ${nomina.fechaInicialPago} al ${nomina.fechaFinalPago} · ${nomina.numDiasPagados} días pagados · Pago ${nomina.fechaPago}`}
        />
      </Card>

      {p.lista.length > 0 && (
        <Card>
          <CardHeader
            title="Percepciones"
            description={`${p.lista.length} ${p.lista.length === 1 ? "percepción" : "percepciones"}`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th className="text-right">Gravado</Th>
                <Th className="text-right">Exento</Th>
              </tr>
            </thead>
            <tbody>
              {p.lista.map((per, i) => (
                <tr key={i}>
                  <Td>
                    <span className="block font-medium text-ink">{per.concepto}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ink-3">
                      Tipo {per.tipoPercepcion} · Clave {per.clave}
                    </span>
                  </Td>
                  <Td className="text-right font-mono">{money(per.importeGravado, moneda)}</Td>
                  <Td className="text-right font-mono">{money(per.importeExento, moneda)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {p.separacionIndemnizacion && (
        <Card>
          <CardHeader title="Separación e indemnización" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-3">
              <Mini label="Total pagado" valor={money(p.separacionIndemnizacion.totalPagado, moneda)} />
              <Mini label="Años de servicio" valor={p.separacionIndemnizacion.numAñosServicio} />
              <Mini
                label="Último sueldo mensual"
                valor={money(p.separacionIndemnizacion.ultimoSueldoMensOrd, moneda)}
              />
              <Mini label="Ingreso acumulable" valor={money(p.separacionIndemnizacion.ingresoAcumulable, moneda)} />
              <Mini
                label="Ingreso no acumulable"
                valor={money(p.separacionIndemnizacion.ingresoNoAcumulable, moneda)}
              />
            </dl>
          </CardBody>
        </Card>
      )}

      {p.jubilacionPensionRetiro && (
        <Card>
          <CardHeader title="Jubilación, pensión o retiro" />
          <CardBody>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-3">
              <Mini
                label="Total en una exhibición"
                valor={money(p.jubilacionPensionRetiro.totalUnaExhibicion, moneda)}
              />
              <Mini
                label="Total en parcialidades"
                valor={money(p.jubilacionPensionRetiro.totalParcialidad, moneda)}
              />
              <Mini label="Monto diario" valor={money(p.jubilacionPensionRetiro.montoDiario, moneda)} />
              <Mini label="Ingreso acumulable" valor={money(p.jubilacionPensionRetiro.ingresoAcumulable, moneda)} />
              <Mini
                label="Ingreso no acumulable"
                valor={money(p.jubilacionPensionRetiro.ingresoNoAcumulable, moneda)}
              />
            </dl>
          </CardBody>
        </Card>
      )}

      {d.lista.length > 0 && (
        <Card>
          <CardHeader
            title="Deducciones"
            description={`${d.lista.length} ${d.lista.length === 1 ? "deducción" : "deducciones"}`}
          />
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th className="text-right">Importe</Th>
              </tr>
            </thead>
            <tbody>
              {d.lista.map((ded, i) => (
                <tr key={i}>
                  <Td>
                    <span className="block font-medium text-ink">{ded.concepto}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ink-3">
                      Tipo {ded.tipoDeduccion} · Clave {ded.clave}
                    </span>
                  </Td>
                  <Td className="text-right font-mono font-semibold text-ink">{money(ded.importe, moneda)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {nomina.otrosPagos.length > 0 && (
        <Card>
          <CardHeader title="Otros pagos" />
          <Table>
            <thead>
              <tr>
                <Th>Concepto</Th>
                <Th className="text-right">Importe</Th>
                <Th className="text-right">Subsidio causado</Th>
              </tr>
            </thead>
            <tbody>
              {nomina.otrosPagos.map((op, i) => (
                <tr key={i}>
                  <Td>
                    <span className="block font-medium text-ink">{op.concepto}</span>
                    <span className="mt-0.5 block font-mono text-[11px] text-ink-3">
                      Tipo {op.tipoOtroPago} · Clave {op.clave}
                    </span>
                  </Td>
                  <Td className="text-right font-mono">{money(op.importe, moneda)}</Td>
                  <Td className="text-right font-mono">
                    {op.subsidioCausado ? money(op.subsidioCausado, moneda) : "—"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}

      {nomina.incapacidades.length > 0 && (
        <Card>
          <CardHeader title="Incapacidades" />
          <Table>
            <thead>
              <tr>
                <Th className="text-right">Días</Th>
                <Th>Tipo</Th>
                <Th className="text-right">Importe pagado</Th>
              </tr>
            </thead>
            <tbody>
              {nomina.incapacidades.map((inc, i) => (
                <tr key={i}>
                  <Td className="text-right font-mono">{inc.diasIncapacidad}</Td>
                  <Td>
                    {inc.tipoIncapacidad} - {NOMBRE_TIPO_INCAPACIDAD[inc.tipoIncapacidad] ?? "—"}
                  </Td>
                  <Td className="text-right font-mono font-semibold text-ink">
                    {money(inc.importeMonetarioPagado, moneda)}
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      )}
    </div>
  );
}

function Mini({ label, valor }: { label: string; valor: string }) {
  return (
    <div>
      <dt className="text-ink-3">{label}</dt>
      <dd className="font-mono font-semibold text-ink">{valor || "—"}</dd>
    </div>
  );
}
