"use client";

import { Button, Note, Pill, useToast } from "@/components/ui";
import { FORMAS_PAGO } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import type { FacturaBorrador, Problema } from "@/lib/facturaNueva";
import {
  cadena,
  complementosPorReceptor,
  folioDe,
  montoDe,
  ordenarPagos,
  round2,
  sumaImportes,
  totalEnPesos,
  type CapturaPagos,
} from "@/lib/pagosCaptura";
import { EditorPago } from "./EditorPago";

/*
   Paso "Pagos" del complemento: la lista de pagos, agrupada por receptor, y
   el botón "Agregar pago" que abre el editor ahí mismo. Cada receptor será su
   propio complemento al timbrar.
*/

/** El pago que se está armando: null = nuevo. */
export type EditorAbierto = { id: string | null; preseleccion?: string[] };

export function PasoPagos({
  borrador,
  set,
  problemas,
  mostrarErrores,
  editor,
  onEditor,
}: {
  borrador: FacturaBorrador;
  set: (cambios: Partial<FacturaBorrador>) => void;
  problemas: Problema[];
  mostrarErrores: boolean;
  editor: EditorAbierto | null;
  onEditor: (e: EditorAbierto | null) => void;
}) {
  const toast = useToast();
  const c = borrador.captura;
  const comps = complementosPorReceptor(c);
  const tramos = cadena(c);

  function guardar(captura: CapturaPagos, partes: number) {
    // Cambiar los pagos invalida la confirmación de "varios complementos".
    set({ captura, confirmaVarios: false });
    onEditor(null);
    toast(partes > 1 ? `Se guardó como ${partes} pagos, uno por receptor` : "Pago guardado");
  }

  function quitar(id: string) {
    const pagos = c.pagos.filter((p) => p.id !== id);
    const usadas = new Set(pagos.flatMap((p) => p.docs.map((d) => d.uuid)));
    set({
      captura: {
        ...c,
        pagos,
        facturas: Object.fromEntries(Object.entries(c.facturas).filter(([u]) => usadas.has(u))),
      },
      confirmaVarios: false,
    });
  }

  if (!borrador.rfcEmisor) {
    return <Note tone="warn">Elige primero el emisor.</Note>;
  }

  return (
    <div className="space-y-4">
      {editor && (
        <EditorPago
          // Un editor por pago: cambiar de pago empieza de cero.
          key={editor.id ?? "nuevo"}
          rfcEmisor={borrador.rfcEmisor}
          captura={c}
          idPago={editor.id}
          preseleccion={editor.preseleccion}
          onGuardar={guardar}
          onCancelar={() => onEditor(null)}
        />
      )}

      {c.pagos.length === 0 ? (
        !editor && (
          <div className="grid justify-items-center gap-2 rounded-xl border-[1.5px] border-dashed border-line bg-surface-2 px-4 py-8 text-center">
            <p className="text-[14px] font-semibold text-ink">Todavía no agregas pagos</p>
            <p className="max-w-sm text-pretty text-[13px] text-ink-3">
              Cada pago es un depósito, cheque o transferencia que recibiste. Tú eliges qué facturas cubre.
            </p>
            <Button variant="primary" className="mt-1" onClick={() => onEditor({ id: null })}>
              Agregar pago
            </Button>
            {mostrarErrores && problemas.length > 0 && (
              <p className="text-[12.5px] font-medium text-danger">{problemas[0].mensaje}</p>
            )}
          </div>
        )
      ) : (
        <>
          {comps.length > 1 && (
            <Note tone="warn" title={`Tus pagos son de ${comps.length} receptores`}>
              Se van a timbrar {comps.length} complementos, uno por receptor. Te lo pediremos confirmar antes de
              timbrar.
            </Note>
          )}

          {comps.map((comp) => (
            <section key={comp.receptor.rfc} aria-label={`Pagos de ${comp.receptor.nombre}`} className="space-y-2">
              <p className="flex flex-wrap items-baseline gap-x-2 text-[13px]">
                <span className="font-semibold text-ink">{comp.receptor.nombre}</span>
                <span className="font-mono text-[12px] text-ink-3">{comp.receptor.rfc}</span>
                <span className="text-ink-3">· total en pesos {money(totalEnPesos(comp.pagos))}</span>
              </p>

              {ordenarPagos(comp.pagos).map((p) => {
                const sobra = round2(montoDe(p) - sumaImportes(p));
                const errores = mostrarErrores
                  ? problemas.filter((x) => x.campo === `pago.${c.pagos.findIndex((y) => y.id === p.id)}`)
                  : [];
                return (
                  <article
                    key={p.id}
                    className="space-y-2.5 rounded-xl border border-line bg-surface p-3.5 data-[mal=true]:border-danger"
                    data-mal={errores.length > 0}
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                      <span className="font-mono text-[16px] font-bold tracking-tight text-ink">
                        {money(montoDe(p), p.moneda)}
                      </span>
                      <span className="font-mono text-[12.5px] text-ink-3">
                        {p.fecha.split("-").reverse().join("/")} {p.hora}
                      </span>
                      <span className="text-[12.5px] text-ink-3">
                        {FORMAS_PAGO.find((f) => f.value === p.forma)?.label ?? p.forma}
                        {p.moneda !== "MXN" && ` · TC ${p.tipoCambio}`}
                      </span>
                      {sobra > 0.004 ? (
                        <Pill tone="warn">Sobran {money(sobra, p.moneda)}</Pill>
                      ) : (
                        <Pill tone="ok">Aplicado completo</Pill>
                      )}
                      <span className="ml-auto flex gap-1">
                        <Button size="sm" variant="secondary" onClick={() => onEditor({ id: p.id })} disabled={editor !== null}>
                          Editar
                        </Button>
                        <Button size="sm" variant="danger" onClick={() => quitar(p.id)} disabled={editor !== null}>
                          Quitar
                        </Button>
                      </span>
                    </div>
                    <ul className="flex flex-wrap gap-2">
                      {p.docs.map((d) => {
                        const f = c.facturas[d.uuid];
                        const t = tramos[`${p.id}|${d.uuid}`];
                        if (!f || !t) return null;
                        return (
                          <li
                            key={d.uuid}
                            className="grid gap-0.5 rounded-lg border border-line-2 bg-surface-2 px-2.5 py-1.5 text-[12px]"
                          >
                            <span className="flex items-baseline gap-2">
                              <span className="font-mono font-semibold text-ink">{folioDe(f)}</span>
                              <span className="font-mono text-ink-2">{money(t.pagado, f.moneda)}</span>
                            </span>
                            <span className="text-ink-3">
                              parc. {t.parcialidad} · queda {money(t.insoluto, f.moneda)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                    {errores.map((e) => (
                      <p key={e.mensaje} className="text-[12.5px] font-medium text-danger">
                        {e.mensaje}
                      </p>
                    ))}
                  </article>
                );
              })}
            </section>
          ))}

          {!editor && (
            <Button variant="primary" onClick={() => onEditor({ id: null })}>
              Agregar otro pago
            </Button>
          )}
        </>
      )}
    </div>
  );
}
