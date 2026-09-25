"use client";

import { useState, type ReactNode } from "react";
import { Button, Card, CardBody, cx } from "@/components/ui";
import { RielPasos, type PasoRiel } from "@/components/facturas/nueva/RielPasos";

/*
   El marco de todo lo que se emite desde la web: factura, nota de crédito,
   pago, carta porte, recibo de nómina, plantilla de Excel y corrida de nómina.
   Riel de pasos a la izquierda, una pregunta por pantalla al centro, lo que se
   va armando a la derecha y el mismo pie abajo. Es la opción A del mockup
   "asistente-unificado" que el usuario aprobó el 2026-09-25.

   Cada flujo pone sus pasos y su lógica; este componente solo pone el marco,
   para que ninguno vuelva a traer su propio Stepper o sus propios botones.
*/

export type { PasoRiel };

export function AsistentePasos({
  riel,
  indice,
  total,
  pregunta,
  porque,
  arriba,
  children,
  debajo,
  pie,
  documento,
  textoVerDocumento = "Ver cómo va el comprobante",
}: {
  riel: {
    tipo: string;
    folio: string;
    icono: ReactNode;
    pasos: PasoRiel[];
    onIr: (id: string) => void;
  };
  /** Posición del paso actual (desde 0) y cuántos pasos hay. */
  indice: number;
  total: number;
  pregunta: ReactNode;
  porque?: ReactNode;
  /** Avisos que van antes de la tarjeta del paso (una prefactura con pendientes, por ejemplo). */
  arriba?: ReactNode;
  /** El cuerpo del paso. */
  children: ReactNode;
  /** Lo que va debajo de la tarjeta: revisión del SAT, errores del timbrado. */
  debajo?: ReactNode;
  pie: { izquierda: ReactNode; derecha: ReactNode; oculto?: boolean };
  /** La columna derecha: el comprobante o el resumen del lote. */
  documento?: ReactNode;
  textoVerDocumento?: string;
}) {
  // En pantallas donde no cabe la tercera columna, el documento se abre con un
  // botón. Se recuerda en qué paso se abrió: al cambiar de paso se cierra solo.
  const [abiertoEn, setAbiertoEn] = useState<number | null>(null);
  const docAbierto = abiertoEn === indice;
  const conDocumento = documento !== undefined && documento !== null;

  return (
    <div
      className={cx(
        "grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[240px_minmax(0,1fr)]",
        conDocumento && "xl:grid-cols-[240px_minmax(0,1fr)_380px]"
      )}
    >
      <RielPasos
        tipo={riel.tipo}
        folio={riel.folio}
        icono={riel.icono}
        pasos={riel.pasos}
        onIr={(id) => riel.onIr(id)}
      />

      <div className="min-w-0 space-y-4">
        {arriba}
        <Card>
          <CardBody className="space-y-5">
            <div className="space-y-1">
              <p className="text-[12px] text-ink-3">
                Paso {indice + 1} de {total}
              </p>
              <h1 className="text-balance text-[22px] font-bold leading-tight tracking-[-0.015em] text-ink">
                {pregunta}
              </h1>
              {porque && <p className="text-pretty text-[14px] text-ink-2">{porque}</p>}
            </div>
            {/* Las secciones que un paso arma como tarjetas quedan planas dentro de
                la tarjeta del paso: sin sombra, solo el borde. */}
            <div className="space-y-5 [&_.shadow-card]:shadow-none">{children}</div>
          </CardBody>
        </Card>

        {debajo}

        {conDocumento && (
          <div className="xl:hidden">
            <Button variant="secondary" onClick={() => setAbiertoEn(docAbierto ? null : indice)} aria-expanded={docAbierto}>
              {docAbierto ? "Ocultar" : textoVerDocumento}
            </Button>
            {docAbierto && <div className="mt-3">{documento}</div>}
          </div>
        )}

        <div
          hidden={pie.oculto}
          className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/90 px-4 py-3 shadow-raised backdrop-blur"
        >
          <div className="flex flex-wrap items-center gap-3">{pie.izquierda}</div>
          <div className="flex flex-wrap items-center gap-3">{pie.derecha}</div>
        </div>
      </div>

      {conDocumento && <aside className="hidden xl:sticky xl:top-20 xl:block">{documento}</aside>}
    </div>
  );
}

/** "N datos por completar", el aviso del pie junto al botón principal. */
export function FaltanDatos({ n }: { n: number }) {
  if (n <= 0) return null;
  return (
    <span className="text-[12px] font-medium text-warn">
      {n} dato{n === 1 ? "" : "s"} por completar
    </span>
  );
}
