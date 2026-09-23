"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import {
  FACTURAS_SECTIONS,
  facturasHref,
  seccionActiva,
  type FacturasSectionKey,
} from "@/lib/facturasNav";
import { NuevaSplitButton } from "@/components/facturas/NuevaSplitButton";

export type FacturasNavCounts = Partial<Record<FacturasSectionKey, number>>;

/**
 * Lateral de Facturas. Mismo papel que EmisorNav, pero aquí el emisor no va en
 * la dirección: sale de la barra superior.
 */
export function FacturasNav({
  counts,
  hayEmisor,
}: {
  counts?: FacturasNavCounts;
  /** Con "todos los emisores" activo, lo que emite no se puede usar. */
  hayEmisor: boolean;
}) {
  const pathname = usePathname();
  const active = seccionActiva(pathname);

  return (
    <div className="lg:sticky lg:top-20">
      <div className="mb-3">
        <NuevaSplitButton hayEmisor={hayEmisor} />
      </div>

      <nav aria-label="Secciones de facturas" className="grid gap-1 lg:block">
        <p className="px-3 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-4">
          Comprobantes
        </p>
        <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
          {FACTURAS_SECTIONS.map((section) => {
            const on = active === section.key;
            const count = counts?.[section.key];
            return (
              <Link
                key={section.key}
                href={facturasHref(section.segment)}
                aria-current={on ? "page" : undefined}
                className={cx(
                  "focus-brand flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.2px] transition",
                  on
                    ? "bg-brand-050 font-semibold text-brand-600"
                    : "font-medium text-ink-2 hover:bg-line-2 hover:text-ink"
                )}
              >
                <span className="truncate">{section.label}</span>
                {typeof count === "number" && (
                  <span
                    className={cx(
                      "ml-auto rounded-full px-2 py-px text-[11px] font-semibold",
                      on ? "bg-brand-100 text-brand-600" : "bg-line-2 text-ink-4"
                    )}
                  >
                    {count}
                  </span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
