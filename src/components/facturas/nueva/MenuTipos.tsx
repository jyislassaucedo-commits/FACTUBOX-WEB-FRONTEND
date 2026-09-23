"use client";

import Link from "next/link";
import { cx } from "@/components/ui";
import { pasosPara } from "@/lib/facturaNueva";
import type { TipoComprobante } from "@/lib/timbrado";

/*
   "¿Qué quieres hacer?": el menú que abre "Nueva factura". Todas las opciones
   pesan lo mismo aunque algunas vivan en otra sección (la nómina, el Excel):
   para quien factura son igual de importantes. Es una cuadrícula de 3 × n, y
   agregar una opción es agregar una entrada a OPCIONES.
*/

type Opcion = {
  clave: string;
  nombre: string;
  descripcion: string;
  ejemplo: string;
  icono: keyof typeof ICONOS;
  /** Qué hace al elegirla. */
  accion:
    | { tipo: "comprobante"; valor: TipoComprobante }
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
    accion: { tipo: "comprobante", valor: "I" },
  },
  {
    clave: "E",
    nombre: "Nota de crédito",
    descripcion: "Descuentas, devuelves o corriges una factura que ya emitiste.",
    ejemplo: "El cliente devolvió una pieza de una factura.",
    icono: "nota",
    accion: { tipo: "comprobante", valor: "E" },
  },
  {
    clave: "P",
    nombre: "Complemento de pago",
    descripcion: "Registras un pago que recibiste de una factura a crédito (PPD).",
    ejemplo: "Tu cliente te transfirió el segundo pago.",
    icono: "pago",
    accion: { tipo: "comprobante", valor: "P" },
  },
  {
    clave: "N",
    nombre: "Nómina",
    descripcion: "Timbra los recibos de nómina de tus empleados.",
    ejemplo: "La quincena del 1 al 15.",
    icono: "nomina",
    accion: { tipo: "enlace", href: "/facturas/nomina" },
  },
  {
    clave: "X",
    nombre: "Varias desde Excel",
    descripcion: "Sube una plantilla con muchas facturas y se timbran en lote.",
    ejemplo: "Las facturas de fin de mes, todas juntas.",
    icono: "excel",
    accion: { tipo: "plantilla" },
  },
  {
    clave: "T",
    nombre: "Traslado",
    descripcion: "Ampara mercancía en tránsito, sin venta de por medio.",
    ejemplo: "Mueves inventario a otra sucursal.",
    icono: "traslado",
    accion: { tipo: "proximamente", motivo: "Necesita carta porte" },
  },
];

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
};

const COLOR_ICONO: Record<keyof typeof ICONOS, string> = {
  factura: "bg-brand-050 text-brand-600",
  nota: "bg-violet-bg text-violet",
  pago: "bg-teal-bg text-teal",
  nomina: "bg-info-bg text-info",
  excel: "bg-ok-bg text-ok",
  traslado: "bg-line-2 text-ink-4",
};

/** El ícono de un tipo de comprobante, el mismo del menú. */
export function IconoTipo({ tipo, className }: { tipo: TipoComprobante; className?: string }) {
  const icono = tipo === "E" ? "nota" : tipo === "P" ? "pago" : "factura";
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
  onElegir: (tipo: TipoComprobante) => void;
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

      <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {OPCIONES.map((o) => (
          <Tarjeta key={o.clave} opcion={o} onElegir={onElegir} onPlantilla={onPlantilla} />
        ))}
      </div>
    </section>
  );
}

function Tarjeta({
  opcion: o,
  onElegir,
  onPlantilla,
}: {
  opcion: Opcion;
  onElegir: (tipo: TipoComprobante) => void;
  onPlantilla: () => void;
}) {
  const apagada = o.accion.tipo === "proximamente";
  const pie =
    o.accion.tipo === "comprobante"
      ? `${pasosPara(o.accion.valor).length} pasos`
      : o.accion.tipo === "enlace"
        ? "Tiene su propia sección"
        : o.accion.tipo === "plantilla"
          ? "Plantilla de Excel"
          : o.accion.motivo;
  const verbo =
    o.accion.tipo === "comprobante"
      ? "Empezar"
      : o.accion.tipo === "enlace"
        ? `Ir a ${o.nombre}`
        : o.accion.tipo === "plantilla"
          ? "Subir plantilla"
          : "Próximamente";

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
        if (accion.tipo === "comprobante") onElegir(accion.valor);
        else if (accion.tipo === "plantilla") onPlantilla();
      }}
    >
      {cuerpo}
    </button>
  );
}
