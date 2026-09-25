"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button, Card, CardBody, Note, Pill, buttonClass, cx, useToast } from "@/components/ui";
import { AsistentePasos } from "@/components/asistente/AsistentePasos";
import type { EstadoPaso, PasoRiel } from "@/components/facturas/nueva/RielPasos";
import { IconoMenu } from "@/components/facturas/nueva/MenuTipos";
import { etiquetaPeriodicidad } from "@/lib/nominaShared";
import type { NombreCorrida } from "@/lib/nomina";
import { CamposNombre, CamposPeriodo, useCorridaForm } from "./CorridaFormModal";

/* ---------------------------------------------------------------------------
   La corrida de nómina en el asistente común.
   ---------------------------------------------------------------------------
   Cuatro pasos, como el Excel: los dos primeros arman la corrida (quién paga y
   qué periodo) y al crearla se pasa a /facturas/nomina/<id>, donde viven los
   otros dos (empleados e incidencias, y timbrar). La corrida queda guardada
   desde el paso 2, así que se puede cerrar y volver.
--------------------------------------------------------------------------- */

export const PASOS_CORRIDA = [
  { id: "emisor", titulo: "Emisor y nombre", pregunta: "¿Qué empresa paga esta nómina?", porque: "Cada corrida es de un emisor y su registro patronal. El nombre sirve para distinguirla si corres varias a la vez." },
  { id: "periodo", titulo: "Periodo", pregunta: "¿Qué periodo vas a pagar?", porque: "Las fechas se proponen solas con el periodo en curso. La fecha de pago decide la tarifa de ISR y la UMA." },
  { id: "empleados", titulo: "Empleados e incidencias", pregunta: "¿A quién le pagas y qué pasó en el periodo?", porque: "Al correrla entran los empleados activos con esta periodicidad. Agrega faltas, horas extra o bonos a quien los tenga." },
  { id: "timbrar", titulo: "Timbrar corrida", pregunta: "Timbra la corrida", porque: "Se timbra un recibo por empleado, uno tras otro. Cada uno consume un timbre." },
] as const;

export type PasoCorridaId = (typeof PASOS_CORRIDA)[number]["id"];

export function rielCorrida(
  actual: number,
  resumenes: Partial<Record<PasoCorridaId, string>>,
  opciones: { habilitados?: PasoCorridaId[]; faltan?: Partial<Record<PasoCorridaId, number>> } = {}
): PasoRiel[] {
  return PASOS_CORRIDA.map((p, i) => {
    const n = opciones.faltan?.[p.id] ?? 0;
    let estado: EstadoPaso = "pendiente";
    if (i === actual) estado = "actual";
    else if (i < actual) estado = n > 0 ? "falta" : "hecho";
    return {
      id: p.id,
      titulo: p.titulo,
      estado,
      resumen: i < actual ? resumenes[p.id] : undefined,
      habilitado: opciones.habilitados ? opciones.habilitados.includes(p.id) : i <= actual,
    };
  });
}

export function NuevaCorridaAsistente({
  rfc,
  nombreEmisor,
  registroPatronal,
  empleadosActivos,
  nombres,
}: {
  rfc: string;
  nombreEmisor: string;
  registroPatronal: string;
  empleadosActivos: number;
  nombres: NombreCorrida[];
}) {
  const router = useRouter();
  const toast = useToast();
  const f = useCorridaForm(rfc);
  const [paso, setPaso] = useState(0);
  const p = PASOS_CORRIDA[paso];
  const extraordinaria = f.tipoNomina === "E";

  async function crear() {
    const id = await f.guardar();
    if (id === null) return;
    toast("Corrida creada");
    router.push(`/facturas/nomina/${id}`);
  }

  return (
    <div className="space-y-4">
      <nav className="text-[12.5px] text-ink-3">
        <Link href="/facturas/nomina" className="hover:text-brand">Nómina</Link>
        <span aria-hidden> / </span>
        <span className="font-medium text-ink-2">Nueva corrida</span>
      </nav>

      <AsistentePasos
        riel={{
          tipo: "Corrida de nómina",
          folio: f.nombre || "Sin nombre",
          icono: <IconoMenu icono="corrida" />,
          pasos: rielCorrida(paso, { emisor: f.nombre || nombreEmisor }),
          onIr: (id) => {
            const i = PASOS_CORRIDA.findIndex((x) => x.id === id);
            if (i <= 1) setPaso(i);
          },
        }}
        indice={paso}
        total={PASOS_CORRIDA.length}
        pregunta={p.pregunta}
        porque={p.porque}
        textoVerDocumento="Ver el resumen de la corrida"
        documento={
          <Card>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">Corrida</span>
                <Pill tone={extraordinaria ? "violet" : "neutral"}>{extraordinaria ? "Extraordinaria" : "Ordinaria"}</Pill>
              </div>
              <Linea etiqueta="Emisor" valor={nombreEmisor} />
              <Linea etiqueta="Registro patronal" valor={registroPatronal || "Sin capturar"} mono={!!registroPatronal} />
              <Linea etiqueta="Nombre" valor={f.nombre || "—"} />
              <Linea etiqueta="Periodicidad" valor={etiquetaPeriodicidad(f.periodicidad)} />
              <Linea etiqueta="Periodo" valor={f.inicio && f.fin ? `${f.inicio} al ${f.fin}` : "—"} mono />
              <Linea etiqueta="Se paga el" valor={f.pago || "—"} mono />
              <Linea etiqueta="Días pagados" valor={f.diasPagados || "—"} mono />
              <p className="border-t border-line pt-3 text-[12.5px] leading-relaxed text-ink-3">
                {extraordinaria
                  ? "No paga el sueldo del periodo: solo lo que captures en cada empleado, como el aguinaldo."
                  : `Al correrla entran los empleados activos con esta periodicidad. Hoy tienes ${empleadosActivos} ${empleadosActivos === 1 ? "empleado activo" : "empleados activos"}.`}
              </p>
            </CardBody>
          </Card>
        }
        debajo={f.error && <Note tone="danger" title="No se pudo crear la corrida">{f.error}</Note>}
        pie={{
          izquierda:
            paso === 0 ? (
              <Link href="/facturas/nueva" className={buttonClass("ghost")}>
                Cambiar tipo
              </Link>
            ) : (
              <Button variant="ghost" onClick={() => setPaso(0)} disabled={f.guardando}>
                Atrás
              </Button>
            ),
          derecha:
            paso === 0 ? (
              <Button variant="primary" onClick={() => setPaso(1)}>
                Continuar
              </Button>
            ) : (
              <Button variant="primary" onClick={() => void crear()} disabled={f.guardando}>
                {f.guardando ? "Creando…" : "Crear corrida"}
              </Button>
            ),
        }}
      >
        {paso === 0 && (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <p className="text-[12px] font-semibold text-ink-3">Emisor</p>
                <p className="mt-0.5 text-[14px] font-semibold text-ink">{nombreEmisor}</p>
                <p className="font-mono text-[12px] text-ink-3">{rfc}</p>
              </div>
              <div className="rounded-xl border border-line bg-surface-2 px-4 py-3">
                <p className="text-[12px] font-semibold text-ink-3">Registro patronal de la empresa</p>
                <p className={cx("mt-0.5 text-[14px] font-semibold", registroPatronal ? "font-mono text-ink" : "text-warn")}>
                  {registroPatronal || "Sin capturar"}
                </p>
                <p className="text-[12px] text-ink-3">Si un empleado tiene uno propio, se usa el suyo.</p>
              </div>
            </div>
            {!registroPatronal && (
              <Note tone="warn">
                La empresa no tiene registro patronal: los empleados que tampoco tengan uno quedarán fuera. Captúralo en{" "}
                <Link href={`/emisores/${encodeURIComponent(rfc)}/empleados`} className="font-semibold underline">
                  Emisor → Empleados
                </Link>
                .
              </Note>
            )}
            <CamposNombre f={f} nombres={nombres} />
          </div>
        )}
        {paso === 1 && <CamposPeriodo f={f} />}
      </AsistentePasos>
    </div>
  );
}

function Linea({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <span className="shrink-0 text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className={cx("min-w-0 truncate text-right text-[12.5px] font-semibold text-ink", mono && "font-mono")}>{valor}</span>
    </div>
  );
}
