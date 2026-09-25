"use client";

/*
   Pantallas que se quedaron del asistente anterior: el resultado del
   timbrado y la revisión contra el SAT. Los pasos viven en ./nueva/Pasos.tsx
   y los del complemento de pago en ./nueva/pagos/.
*/

import Link from "next/link";
import { Button, Card, CardBody, CardHeader, Note, buttonClass } from "@/components/ui";
import { fechaHora } from "@/lib/cfdi";
import type { HallazgoSat } from "@/lib/timbrado";

/* ========================================================================== */
/* Resultado                                                                  */
/* ========================================================================== */

export function ResultadoTimbrado({
  titulo,
  uuid,
  fechaTimbrado,
  onOtra,
  siguiente,
}: {
  /** Ej. "Factura timbrada", "Nota de crédito timbrada". */
  titulo: string;
  uuid: string;
  fechaTimbrado: string;
  onOtra: () => void;
  /** Lo que conviene hacer después (p. ej. la factura del servicio del intermediario). */
  siguiente?: { texto: string; boton: string; onClick: () => void };
}) {
  return (
    <Card className="mx-auto max-w-xl">
      <CardBody className="text-center">
        <span
          className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-ok-bg text-xl text-ok"
          aria-hidden
        >
          ✓
        </span>
        <h2 className="mt-3 text-lg font-bold tracking-tight text-ink">{titulo}</h2>
        <p className="mt-1 text-[13px] text-ink-3">
          Ya quedó registrada ante el SAT el {fechaHora(fechaTimbrado).replace(/.$/, "")}.
        </p>
        <p className="mt-4 break-all rounded-lg border border-line bg-surface-2 p-3 font-mono text-[12px] text-ink">
          {uuid}
        </p>
        {siguiente && (
          <div className="mt-4 rounded-xl border border-brand bg-brand-050 p-3.5 text-left text-[13px] text-ink">
            <p>{siguiente.texto}</p>
            <button type="button" onClick={siguiente.onClick} className={buttonClass("primary", "md", "mt-2.5")}>
              {siguiente.boton}
            </button>
          </div>
        )}
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <Link href="/facturas" className={buttonClass("secondary")}>
            Ver mis facturas
          </Link>
          <Button variant="primary" onClick={onOtra}>
            Hacer otro comprobante
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Revisión contra el SAT                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Resultado de pasar el comprobante ya armado y sellado por los esquemas,
 * catálogos y reglas del SAT, en el servidor.
 *
 * Es distinto del panel de "Falta información": ese revisa el borrador y ve
 * campos vacíos; esto revisa el XML que de verdad va a recibir el PAC y ve lo
 * que solo se nota con el comprobante hecho — que los importes no cuadren, que
 * el uso del CFDI no vaya con el régimen del receptor, que la clave ya no esté
 * vigente.
 *
 * Un fallo de la revisión no es lo mismo que un comprobante malo: si el
 * servidor no pudo revisar, se dice y se deja timbrar. No tiene sentido dejar
 * a alguien sin facturar porque nuestra revisión se cayó.
 */
export function RevisionSat({
  revisando,
  hayResultado,
  errores,
  advertencias,
  noRevisado,
  motivoFallo,
  onReintentar,
}: {
  revisando: boolean;
  /** Hay un veredicto para el comprobante tal como está ahora. */
  hayResultado: boolean;
  errores: HallazgoSat[];
  advertencias: HallazgoSat[];
  /** Capas del validador que no se pudieron correr, con el motivo. */
  noRevisado: string[];
  /** Por qué no se pudo revisar, si es que no se pudo. */
  motivoFallo: string | null;
  onReintentar: () => void;
}) {
  if (revisando) {
    return (
      <Note tone="info" title="Revisando ante el SAT…">
        Se está armando el comprobante y comparándolo con los esquemas y
        catálogos oficiales. No consume timbres.
      </Note>
    );
  }

  if (motivoFallo !== null) {
    return (
      <Note tone="warn" title="No se pudo revisar el comprobante">
        {motivoFallo} Puedes timbrar de todas formas, pero sin esta comprobación
        el PAC podría rechazarlo y el timbre se consumiría igual.{" "}
        <button
          type="button"
          onClick={onReintentar}
          className="font-semibold underline underline-offset-2"
        >
          Reintentar
        </button>
      </Note>
    );
  }

  if (!hayResultado) {
    return null;
  }

  return (
    <div className="space-y-3">
      {errores.length > 0 && (
        <Card>
          <CardHeader
            title={
              errores.length === 1
                ? "El SAT rechazaría este comprobante"
                : `El SAT rechazaría este comprobante (${errores.length} motivos)`
            }
            description="Se revisó el CFDI ya armado y sellado. Hay que corregir esto antes de timbrar; si se manda así, el timbre se consume y el comprobante no se emite."
          />
          <CardBody className="space-y-1.5">
            {errores.map((e, i) => (
              <div
                key={e.campo + i}
                className="rounded-xl border border-danger/40 bg-danger-bg px-3.5 py-2.5"
              >
                <p className="font-mono text-[11.5px] font-semibold text-danger">{e.campo}</p>
                <p className="mt-0.5 text-[12.5px] leading-relaxed text-danger">{e.mensaje}</p>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {errores.length === 0 && noRevisado.length === 0 && (
        <Note tone="ok" title="El comprobante pasa las reglas del SAT">
          Se revisó contra los esquemas oficiales, los catálogos vigentes y el
          sello. Nada de esto consumió timbres.
        </Note>
      )}

      {/* Cuando alguna capa no corrió, el visto bueno vale menos de lo que
          parece: decir "pasa las reglas del SAT" habiendo revisado tres cuartas
          partes es peor que no decir nada, porque el usuario timbra confiado.
          Se muestra también junto a los errores — saber que encima faltó
          revisar algo cambia lo que uno hace después de corregir. */}
      {noRevisado.length > 0 && (
        <Note
          tone="warn"
          title={
            errores.length === 0
              ? "El comprobante pasa lo que se pudo revisar"
              : "Además, quedó algo sin revisar"
          }
        >
          <ul className="mt-1 space-y-1">
            {noRevisado.map((motivo, i) => (
              <li key={motivo + i}>· {motivo}</li>
            ))}
          </ul>
          <p className="mt-1.5 opacity-80">
            Puedes timbrar, pero de esa parte no hay quien avise antes que el
            PAC.
          </p>
        </Note>
      )}

      {advertencias.length > 0 && (
        <Note
          tone="warn"
          title={
            advertencias.length === 1
              ? "Un detalle que conviene revisar"
              : `${advertencias.length} detalles que conviene revisar`
          }
        >
          <ul className="mt-1 space-y-1">
            {advertencias.map((a, i) => (
              <li key={a.campo + i}>
                · <span className="font-mono text-[11.5px]">{a.campo}</span> {a.mensaje}
              </li>
            ))}
          </ul>
          <p className="mt-1.5 opacity-80">Esto no impide timbrar.</p>
        </Note>
      )}
    </div>
  );
}
