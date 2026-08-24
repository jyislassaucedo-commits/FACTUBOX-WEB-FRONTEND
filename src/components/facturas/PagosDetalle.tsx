"use client";

import { Card, CardBody, CardHeader, Pill, Table, Td, Th } from "@/components/ui";
import { fechaHora, money, type CfdiPagos } from "@/lib/cfdi";

const ETIQUETAS_TOTALES: Array<[keyof CfdiPagos["totales"], string]> = [
  ["totalTrasladosBaseIVA16", "Trasladado (base) IVA 16%"],
  ["totalTrasladosImpuestoIVA16", "Trasladado IVA 16%"],
  ["totalTrasladosBaseIVA8", "Trasladado (base) IVA 8%"],
  ["totalTrasladosImpuestoIVA8", "Trasladado IVA 8%"],
  ["totalTrasladosBaseIVA0", "Trasladado (base) IVA 0%"],
  ["totalTrasladosImpuestoIVA0", "Trasladado IVA 0%"],
  ["totalTrasladosBaseIVAExento", "Trasladado (base) exento"],
  ["totalRetencionesIVA", "Retenido IVA"],
  ["totalRetencionesISR", "Retenido ISR"],
  ["totalRetencionesIEPS", "Retenido IEPS"],
  ["montoTotalPagos", "Monto total de pagos"],
];

const NOMBRE_IMPUESTO: Record<string, string> = { "001": "ISR", "002": "IVA", "003": "IEPS" };

/**
 * Reemplaza a "Conceptos" cuando el comprobante es un complemento de Pagos
 * 2.0: lo que importa aquí son los pagos aplicados a cada documento
 * relacionado, no un concepto de relleno.
 */
export function PagosDetalle({ pagos, moneda }: { pagos: CfdiPagos; moneda: string }) {
  const totalesPresentes = ETIQUETAS_TOTALES.filter(([campo]) => pagos.totales[campo]);

  return (
    <div className="space-y-4">
      {totalesPresentes.length > 0 && (
        <Card>
          <CardHeader title="Totales del complemento de pagos" />
          <CardBody className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12.5px] sm:grid-cols-3">
            {totalesPresentes.map(([campo, etiqueta]) => (
              <div key={campo}>
                <dt className="text-ink-3">{etiqueta}</dt>
                {/* Estos totales no traen su propia moneda en el XML (agregan
                    los pagos), y la del comprobante es "XXX" en un CFDI de
                    Pago - no la usamos aquí, se mostraría un sufijo falso. */}
                <dd className="font-mono font-semibold text-ink">
                  {money(pagos.totales[campo])}
                </dd>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {pagos.pagos.map((pago, i) => (
        <Card key={i}>
          <CardHeader
            title={`Pago ${i + 1}`}
            description={
              <span className="flex flex-wrap gap-x-4 gap-y-1">
                <span>{fechaHora(pago.fechaPago)}</span>
                <span>Forma de pago {pago.formaDePagoP}</span>
                <span>
                  {pago.monedaP}
                  {pago.tipoCambioP && pago.tipoCambioP !== "1" ? ` · TC ${pago.tipoCambioP}` : ""}
                </span>
              </span>
            }
            action={
              <Pill tone="brand">{money(pago.monto, pago.monedaP || moneda)}</Pill>
            }
          />
          <Table>
            <thead>
              <tr>
                <Th>Documento</Th>
                <Th className="text-right">Parcialidad</Th>
                <Th className="text-right">Saldo anterior</Th>
                <Th className="text-right">Pagado</Th>
                <Th className="text-right">Saldo insoluto</Th>
              </tr>
            </thead>
            <tbody>
              {pago.doctoRelacionado.map((d, j) => (
                <tr key={j}>
                  <Td>
                    <span className="block font-mono text-[12px] text-ink">{d.idDocumento}</span>
                    <span className="mt-0.5 block text-[11px] text-ink-3">
                      {[d.serie, d.folio].filter(Boolean).join("-") || "—"} · {d.monedaDR}
                    </span>
                    {(d.trasladosDR.length > 0 || d.retencionesDR.length > 0) && (
                      <span className="mt-1.5 flex flex-wrap gap-1">
                        {d.trasladosDR.map((t, k) => (
                          <Pill key={`t${k}`} tone="info">
                            Traslado {NOMBRE_IMPUESTO[t.impuesto] ?? t.impuesto}{" "}
                            {t.tipoFactor === "Tasa" ? `${(parseFloat(t.tasaOCuota) * 100).toFixed(2)}%` : t.tasaOCuota}{" "}
                            · {money(t.importe, moneda)}
                          </Pill>
                        ))}
                        {d.retencionesDR.map((t, k) => (
                          <Pill key={`r${k}`} tone="warn">
                            Retención {NOMBRE_IMPUESTO[t.impuesto] ?? t.impuesto} · {money(t.importe, moneda)}
                          </Pill>
                        ))}
                      </span>
                    )}
                  </Td>
                  <Td className="text-right font-mono">{d.numParcialidad}</Td>
                  <Td className="text-right font-mono">{money(d.impSaldoAnt, d.monedaDR || moneda)}</Td>
                  <Td className="text-right font-mono font-semibold text-ink">
                    {money(d.impPagado, d.monedaDR || moneda)}
                  </Td>
                  <Td className="text-right font-mono">{money(d.impSaldoInsoluto, d.monedaDR || moneda)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
