"use client";

import Link from "next/link";
import { cx } from "@/components/ui";
import { pasosPara } from "@/lib/facturaNueva";
import type { TipoComprobante } from "@/lib/timbrado";

/*
   "¿Qué quieres hacer?": el menú que abre "Nueva factura". Todas las opciones
   pesan lo mismo aunque algunas vivan en otra sección (la nómina, el Excel):
   para quien factura son igual de importantes, y todas entran al mismo
   asistente por pasos. Van en dos grupos, "Uno a la vez" y "Muchos a la vez"
   (mockup asistente-unificado, aprobado el 2026-09-25); agregar una opción es
   agregar una entrada a OPCIONES con su grupo.
*/

type Opcion = {
  clave: string;
  nombre: string;
  descripcion: string;
  ejemplo: string;
  icono: keyof typeof ICONOS;
  grupo: "uno" | "muchos";
  /** Cuántos pasos tiene, cuando no es un comprobante del asistente de factura. */
  pasos?: number;
  /** Qué hace al elegirla. */
  accion:
    | { tipo: "comprobante"; valor: TipoComprobante; cartaPorte?: boolean }
    | { tipo: "plantilla" }
    | { tipo: "enlace"; href: string }
    | { tipo: "proximamente"; motivo: string };
};

const OPCIONES: Opcion[] = [
  {
    clave: "I",
    nombre: "Factura",
    descripcion: "Cobras por una venta o un servicio.",
    ejemplo: "Vendiste dos laptops y su instalación.",
    icono: "factura",
    grupo: "uno",
    accion: { tipo: "comprobante", valor: "I" },
  },
  {
    clave: "E",
    nombre: "Nota de crédito",
    descripcion: "Descuentas, devuelves o corriges una factura que ya emitiste.",
    ejemplo: "El cliente devolvió una pieza de una factura.",
    icono: "nota",
    grupo: "uno",
    accion: { tipo: "comprobante", valor: "E" },
  },
  {
    clave: "P",
    nombre: "Complemento de pago",
    descripcion: "Registras un pago que recibiste de una factura a crédito (PPD).",
    ejemplo: "Tu cliente te transfirió el segundo pago.",
    icono: "pago",
    grupo: "uno",
    accion: { tipo: "comprobante", valor: "P" },
  },
  {
    clave: "T",
    nombre: "Carta porte",
    descripcion: "Para mover mercancía. Primero te preguntamos tu papel en el viaje y con eso sabemos qué timbrar.",
    ejemplo: "Llevas inventario a otra sucursal, o le cobras un flete a un cliente.",
    icono: "traslado",
    grupo: "uno",
    accion: { tipo: "comprobante", valor: "T" },
  },
  {
    clave: "N",
    nombre: "Recibo de nómina",
    descripcion: "Un recibo para un empleado, capturado aquí o a partir de una prenómina.",
    ejemplo: "El finiquito de alguien que se va.",
    icono: "nomina",
    grupo: "uno",
    pasos: 6,
    accion: { tipo: "enlace", href: "/facturas/nomina/manual" },
  },
  {
    clave: "X",
    nombre: "Desde Excel",
    descripcion: "Sube una plantilla de facturas, complementos de pago o recibos de nómina y se timbran en lote.",
    ejemplo: "Las facturas de fin de mes, todas juntas.",
    icono: "excel",
    grupo: "muchos",
    pasos: 4,
    accion: { tipo: "plantilla" },
  },
  {
    clave: "C",
    nombre: "Corrida de nómina",
    descripcion: "Calcula el periodo para todos tus empleados y timbra los recibos juntos.",
    ejemplo: "La quincena del 1 al 15.",
    icono: "corrida",
    grupo: "muchos",
    pasos: 4,
    accion: { tipo: "enlace", href: "/facturas/nomina/nueva" },
  },
];

const GRUPOS = [
  { clave: "uno", titulo: "Uno a la vez" },
  { clave: "muchos", titulo: "Muchos a la vez" },
] as const;

const ICONOS = {
  factura: (
    <>
      <path d="M5 2.5h7l3 3v12H5z" />
      <path d="M8 9h5M8 12h5M8 15h3" />
    </>
  ),
  nota: (
    <>
      <path d="M5 2.5h7l3 3v12H5z" />
      <path d="M7.5 11.5h5" />
    </>
  ),
  pago: (
    <>
      <rect x="2.5" y="5" width="15" height="10" rx="2" />
      <path d="M2.5 8.5h15M6 12h3" />
    </>
  ),
  nomina: (
    <>
      <circle cx="10" cy="7" r="3" />
      <path d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" />
    </>
  ),
  corrida: (
    <>
      <circle cx="7.5" cy="7" r="2.5" />
      <path d="M2.5 16.5c.6-2.6 2.5-4 5-4s4.4 1.4 5 4" />
      <path d="M13 4.8a2.5 2.5 0 0 1 0 4.4M14.5 12.7c1.5.4 2.6 1.7 3 3.8" />
    </>
  ),
  excel: (
    <>
      <rect x="3" y="3" width="14" height="14" rx="2" />
      <path d="M3 8h14M3 12.5h14M8 3v14" />
    </>
  ),
  traslado: (
    <>
      <path d="M2.5 5.5h9v8h-9zM11.5 8.5h3.5l2.5 2.5v2.5h-6" />
      <circle cx="6" cy="15" r="1.5" />
      <circle cx="14.5" cy="15" r="1.5" />
    </>
  ),
  flete: (
    <>
      <path d="M2.5 5.5h9v8h-9zM11.5 8.5h3.5l2.5 2.5v2.5h-6" />
      <circle cx="6" cy="15" r="1.5" />
      <circle cx="14.5" cy="15" r="1.5" />
      <path d="M5 9.5h3.5" />
    </>
  ),
};

const COLOR_ICONO: Record<keyof typeof ICONOS, string> = {
  factura: "bg-brand-050 text-brand-600",
  nota: "bg-violet-bg text-violet",
  pago: "bg-teal-bg text-teal",
  nomina: "bg-info-bg text-info",
  corrida: "bg-info-bg text-info",
  excel: "bg-ok-bg text-ok",
  traslado: "bg-teal-bg text-teal",
  flete: "bg-warn-bg text-warn",
};

/** El ícono de un tipo de comprobante, el mismo del menú. */
export function IconoTipo({ tipo, className }: { tipo: TipoComprobante; className?: string }) {
  const icono = tipo === "E" ? "nota" : tipo === "P" ? "pago" : tipo === "T" ? "traslado" : "factura";
  return <IconoMenu icono={icono} className={className} />;
}

export type NombreIcono = keyof typeof ICONOS;

/** Cualquier ícono del menú (nómina, Excel…), para el riel de los asistentes que no son un TipoComprobante. */
export function IconoMenu({ icono, className }: { icono: NombreIcono; className?: string }) {
  return (
    <span
      className={cx("grid size-9 flex-none place-items-center rounded-[10px]", COLOR_ICONO[icono], className)}
      aria-hidden
    >
      <svg
        viewBox="0 0 20 20"
        className="size-[18px]"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {ICONOS[icono]}
      </svg>
    </span>
  );
}

export function MenuTipos({
  onElegir,
  onPlantilla,
}: {
  onElegir: (tipo: TipoComprobante, cartaPorte?: boolean) => void;
  onPlantilla: () => void;
}) {
  return (
    <section className="mx-auto max-w-5xl space-y-5">
      <div className="space-y-1">
        <h1 className="text-balance text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-ink md:text-[34px]">
          ¿Qué quieres hacer?
        </h1>
        <p className="text-[15px] text-ink-2">Elige el tipo de comprobante. Te guiamos paso a paso.</p>
      </div>

      {GRUPOS.map((g) => (
        <div key={g.clave} className="space-y-2.5">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.07em] text-ink-3">{g.titulo}</h2>
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {OPCIONES.filter((o) => o.grupo === g.clave).map((o) => (
              <Tarjeta key={o.clave} opcion={o} onElegir={onElegir} onPlantilla={onPlantilla} />
            ))}
          </div>
        </div>
      ))}

      <p className="rounded-xl border border-dashed border-line px-4 py-3 text-[13px] text-ink-3">
        <span className="font-semibold text-ink-2">Autofactura</span> no está aquí porque no timbra al crearla: genera
        la liga o el QR para que tu cliente se facture solo. Está en{" "}
        <Link href="/facturas/autofacturas" className="font-semibold text-brand hover:underline">
          Facturas → Autofacturas
        </Link>
        .
      </p>
    </section>
  );
}

function Tarjeta({
  opcion: o,
  onElegir,
  onPlantilla,
}: {
  opcion: Opcion;
  onElegir: (tipo: TipoComprobante, cartaPorte?: boolean) => void;
  onPlantilla: () => void;
}) {
  const apagada = o.accion.tipo === "proximamente";
  const pie =
    o.accion.tipo === "comprobante"
      ? `${pasosPara(o.accion.valor, o.accion.cartaPorte).length} pasos`
      : o.accion.tipo === "proximamente"
        ? o.accion.motivo
        : `${o.pasos} pasos`;
  const verbo = o.accion.tipo === "proximamente" ? "Próximamente" : "Empezar";

  const clases = cx(
    "focus-brand flex h-full flex-col gap-3 rounded-2xl border p-5 text-left transition",
    apagada
      ? "cursor-not-allowed border-line bg-surface-2"
      : "border-line bg-surface shadow-card hover:-translate-y-0.5 hover:border-brand"
  );

  const cuerpo = (
    <>
      <span className={cx("grid size-10 place-items-center rounded-[10px]", COLOR_ICONO[o.icono])} aria-hidden>
        <svg
          viewBox="0 0 20 20"
          className="size-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.7"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {ICONOS[o.icono]}
        </svg>
      </span>
      <span className={cx("text-[18px] font-bold tracking-tight", apagada ? "text-ink-3" : "text-ink")}>
        {o.nombre}
      </span>
      <span className={cx("text-[13.5px]", apagada ? "text-ink-3" : "text-ink-2")}>{o.descripcion}</span>
      <span className="mt-auto border-t border-dashed border-line pt-2.5 text-[12.5px] text-ink-3">
        Por ejemplo: {o.ejemplo}
      </span>
      <span className="flex items-center justify-between text-[12.5px] text-ink-3">
        <span>{pie}</span>
        <span className={cx("font-semibold", apagada ? "text-ink-3" : "text-brand-600")}>{verbo}</span>
      </span>
    </>
  );

  if (o.accion.tipo === "enlace") {
    return (
      <Link href={o.accion.href} className={clases}>
        {cuerpo}
      </Link>
    );
  }

  const accion = o.accion;
  return (
    <button
      type="button"
      disabled={apagada}
      className={clases}
      onClick={() => {
        if (accion.tipo === "comprobante") onElegir(accion.valor, accion.cartaPorte);
        else if (accion.tipo === "plantilla") onPlantilla();
      }}
    >
      {cuerpo}
    </button>
  );
}
