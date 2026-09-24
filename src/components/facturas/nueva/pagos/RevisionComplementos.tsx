"use client";

import Link from "next/link";
import { Button, Card, CardBody, Note, Pill, buttonClass } from "@/components/ui";
import { money } from "@/lib/cfdi";
import type { FacturaBorrador } from "@/lib/facturaNueva";
import { complementosPorReceptor, totalEnPesos } from "@/lib/pagosCaptura";
import type { TimbrarResult } from "@/lib/timbrado";

/** Un comprobante del lote: timbrado (ok) o con el motivo del rechazo. */
export type Emitido = {
  /** RFC del receptor: identifica al complemento entre intentos. */
  clave: string;
  etiqueta: string;
  folio: string;
  ok?: TimbrarResult;
  error?: string;
};

/**
 * En la revisión del complemento: qué comprobantes van a salir. Con varios
 * receptores se timbra uno por receptor, y el usuario lo confirma.
 */
export function RevisionComplementos({
  borrador,
  set,
  mostrarErrores,
}: {
  borrador: FacturaBorrador;
  set: (cambios: Partial<FacturaBorrador>) => void;
  mostrarErrores: boolean;
}) {
  const comps = complementosPorReceptor(borrador.captura);
  if (comps.length === 0) return null;
  const base = parseInt(borrador.folio, 10);
  const folio = (i: number) =>
    borrador.serie ? `${borrador.serie}-${Number.isFinite(base) ? base + i : borrador.folio}` : "Sin folio";

  return (
    <div className="space-y-3">
      {comps.length > 1 && (
        <Note tone={mostrarErrores && !borrador.confirmaVarios ? "danger" : "warn"} title={`Vas a timbrar ${comps.length} complementos`}>
          <p>
            Tus pagos son de {comps.length} receptores distintos y un complemento solo lleva uno, así que cada receptor
            recibe su propio comprobante, con su folio y su timbre.
          </p>
          <label className="mt-2 flex items-center gap-2 font-semibold text-ink">
            <input
              type="checkbox"
              checked={borrador.confirmaVarios}
              onChange={(e) => set({ confirmaVarios: e.target.checked })}
              className="size-4 accent-[var(--brand)]"
            />
            Entendido: timbrar {comps.length} complementos
          </label>
        </Note>
      )}
      <div className="relative overflow-x-auto rounded-xl border border-line bg-surface">
        <table className="w-full min-w-[480px] border-collapse text-left text-[13px]">
          <thead>
            <tr className="bg-surface-2 text-[11.5px] text-ink-3">
              <th className="px-3 py-2 font-semibold">Complemento</th>
              <th className="px-3 py-2 font-semibold">Receptor</th>
              <th className="px-3 py-2 text-right font-semibold">Pagos</th>
              <th className="px-3 py-2 text-right font-semibold">Total en pesos</th>
            </tr>
          </thead>
          <tbody>
            {comps.map((c, i) => (
              <tr key={c.receptor.rfc} className="border-t border-line-2">
                <td className="whitespace-nowrap px-3 py-2.5 font-mono font-semibold text-ink">{folio(i)}</td>
                <td className="px-3 py-2.5 text-ink-2">
                  <span className="block">{c.receptor.nombre}</span>
                  <span className="font-mono text-[11.5px] text-ink-4">{c.receptor.rfc}</span>
                </td>
                <td className="px-3 py-2.5 text-right text-ink-2">{c.pagos.length}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right font-mono font-semibold text-ink">
                  {money(totalEnPesos(c.pagos))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {comps.length > 1 && (
        <p className="text-[12px] text-ink-3">
          Los folios son una estimación: cada uno se confirma con la serie justo antes de timbrarlo.
        </p>
      )}
    </div>
  );
}

/** Cuando se timbraron varios complementos, o alguno falló. */
export function ResultadoComplementos({
  serie,
  emitidos,
  enviando,
  onReintentar,
  onOtra,
}: {
  serie: string;
  emitidos: Emitido[];
  enviando: boolean;
  onReintentar: () => void;
  onOtra: () => void;
}) {
  const fallidos = emitidos.filter((e) => !e.ok).length;
  const bien = emitidos.length - fallidos;
  return (
    <Card className="mx-auto max-w-2xl">
      <CardBody className="space-y-4">
        <div className="text-center">
          <span
            className={
              fallidos
                ? "mx-auto grid h-12 w-12 place-items-center rounded-full bg-warn-bg text-xl text-warn"
                : "mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-bg text-xl text-ok"
            }
            aria-hidden
          >
            {fallidos ? "!" : "✓"}
          </span>
          <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">
            {fallidos ? `Se timbraron ${bien} de ${emitidos.length} complementos` : `${bien} complementos timbrados`}
          </h2>
          <p className="mt-1 text-[13px] text-ink-3">
            {fallidos
              ? "Los timbrados ya quedaron ante el SAT. Revisa el motivo de los que faltan y vuelve a intentarlo: solo se timbran esos."
              : "Cada receptor recibe su propio comprobante."}
          </p>
        </div>

        <ul className="divide-y divide-line-2 overflow-hidden rounded-xl border border-line">
          {emitidos.map((e) => (
            <li key={e.clave} className="grid gap-1 px-3.5 py-3 text-[13px]">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-ink">{e.etiqueta}</span>
                {e.folio && serie && <span className="font-mono text-ink-3">{`${serie}-${e.folio}`}</span>}
                <span className="ml-auto">
                  {e.ok ? <Pill tone="ok">Timbrado</Pill> : <Pill tone="danger">No se timbró</Pill>}
                </span>
              </div>
              {e.ok ? (
                <span className="break-all font-mono text-[12px] text-ink-2">{e.ok.UUID}</span>
              ) : (
                <span className="text-[12.5px] text-danger">{e.error}</span>
              )}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap justify-center gap-2">
          <Link href="/facturas" className={buttonClass("secondary")}>
            Ver mis facturas
          </Link>
          {fallidos > 0 && (
            <Button variant="primary" onClick={onReintentar} disabled={enviando}>
              {enviando ? "Timbrando…" : `Reintentar ${fallidos === 1 ? "el que falta" : `los ${fallidos} que faltan`}`}
            </Button>
          )}
          <Button variant={fallidos ? "ghost" : "primary"} onClick={onOtra}>
            Hacer otro comprobante
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
