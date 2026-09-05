"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";
import {
  EMISOR_SECTIONS,
  activeSection,
  emisorHref,
  iniciales,
  type EmisorSectionKey,
} from "@/lib/emisorNav";

export type EmisorNavCounts = Partial<Record<EmisorSectionKey, number>>;

/**
 * Sidebar contextual del emisor. Al entrar a /emisores/<rfc> el menu deja de
 * ser el global y pasa a ser el de ESTE emisor.
 */
export function EmisorNav({
  rfc,
  nombre,
  counts,
  alertas,
}: {
  rfc: string;
  nombre: string;
  counts?: EmisorNavCounts;
  /** Secciones que deben mostrar un punto de atencion (ej. CSD por vencer). */
  alertas?: EmisorSectionKey[];
}) {
  const pathname = usePathname();
  const active = activeSection(pathname, rfc);

  const grupos = [
    { titulo: "Emisor", items: EMISOR_SECTIONS.filter((s) => s.group === "emisor") },
    { titulo: "Catálogos", items: EMISOR_SECTIONS.filter((s) => s.group === "catalogos") },
    { titulo: "Operación", items: EMISOR_SECTIONS.filter((s) => s.group === "operacion") },
  ];

  return (
    <div className="lg:sticky lg:top-20">
      <nav aria-label="Miga de pan" className="mb-3.5 flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Link href="/emisores" className="focus-brand rounded hover:text-brand">
          Emisores
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate font-medium text-ink-2">{nombre}</span>
      </nav>

      <div className="mb-3 rounded-card border border-line bg-surface p-3.5 shadow-card">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-ink text-[13px] font-extrabold tracking-tight text-background">
            {iniciales(nombre, 3)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold leading-tight text-ink">{nombre}</p>
            <p className="mt-0.5 truncate font-mono text-[11.5px] text-ink-3">{rfc}</p>
          </div>
        </div>
        <Link
          href="/emisores"
          className="focus-brand mt-3 flex w-full items-center justify-between gap-2 rounded-[10px] border border-dashed border-line bg-surface-2 px-3 py-2 text-xs text-ink-2 transition hover:border-brand hover:text-brand"
        >
          Cambiar de emisor
          <span aria-hidden>⇅</span>
        </Link>
      </div>

      <nav aria-label="Secciones del emisor" className="grid gap-1 lg:block">
        {grupos.map((grupo) => (
          <div key={grupo.titulo} className="mb-1.5">
            <p className="px-3 pb-1.5 pt-2.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-4">
              {grupo.titulo}
            </p>
            <div className="grid gap-0.5 sm:grid-cols-2 lg:grid-cols-1">
              {grupo.items.map((section) => {
                const on = active === section.key;
                const count = counts?.[section.key];
                return (
                  <Link
                    key={section.key}
                    href={emisorHref(rfc, section.segment)}
                    aria-current={on ? "page" : undefined}
                    className={cx(
                      "focus-brand flex items-center gap-2.5 rounded-[10px] px-3 py-2 text-[13.2px] transition",
                      on
                        ? "bg-brand-050 font-semibold text-brand-600"
                        : "font-medium text-ink-2 hover:bg-line-2 hover:text-ink"
                    )}
                  >
                    <span className="truncate">{section.label}</span>
                    {alertas?.includes(section.key) && (
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-warn"
                        aria-label="Requiere atención"
                      />
                    )}
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
          </div>
        ))}
      </nav>
    </div>
  );
}
