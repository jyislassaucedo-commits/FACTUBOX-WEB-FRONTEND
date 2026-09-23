"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cx } from "@/components/ui";
import { iniciales } from "@/lib/emisorNav";
import type { Emisor } from "@/lib/emisores";

/* ---------------------------------------------------------------------------
   El emisor activo, en la barra superior.
   ---------------------------------------------------------------------------
   Sustituye a deducirlo del pathname. Antes, "con quién facturo" dependía de en
   qué pantalla estabas; ahora es un estado que se ve y se cambia desde
   cualquier sitio, como en la aplicacion de escritorio.

   Cambiarlo escribe una cookie y refresca: los datos los pinta el servidor, así
   que no hay que duplicar el estado en el cliente. La excepción está en
   destino(): dentro de /emisores/<rfc> hay que navegar, no refrescar.
--------------------------------------------------------------------------- */

export function SelectorEmisor({
  emisores,
  rfcActivo,
}: {
  emisores: Emisor[];
  /** "" = todos los emisores. */
  rfcActivo: string;
}) {
  const [open, setOpen] = useState(false);
  const [cambiando, setCambiando] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Con un solo emisor no hay nada que elegir: se enseña cuál es, sin menú.
  const unico = emisores.length === 1;
  const activo = emisores.find((e) => e.Rfc === rfcActivo) ?? null;

  /**
   * A dónde ir tras cambiar de emisor.
   *
   * Normalmente a ningún lado: se refresca y te quedas donde estabas, porque
   * las pantallas de Facturas valen para cualquier emisor.
   *
   * Dentro de /emisores/<rfc> es distinto: esa dirección ES de un emisor, y el
   * proxy sincroniza la cookie con ella. Si solo refrescáramos, el cambio se
   * desharía en el acto — el proxy volvería a poner el de la URL. Así que se
   * navega: al mismo apartado del emisor nuevo, o a la lista si elegiste
   * "todos".
   */
  function destino(rfc: string): string | null {
    const m = /^\/emisores\/([^/]+)(\/.*)?$/.exec(pathname);
    if (!m || m[1] === "nuevo") return null;
    if (rfc === "") return "/emisores";
    return `/emisores/${encodeURIComponent(rfc)}${m[2] ?? ""}`;
  }

  async function elegir(rfc: string) {
    setOpen(false);
    if (rfc === rfcActivo) return;
    setCambiando(true);
    try {
      await fetch("/api/emisor-activo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc }),
      });
      const aDonde = destino(rfc);
      if (aDonde) router.push(aDonde);
      // Siempre, también tras navegar: el layout de (app) es compartido y
      // Next no lo vuelve a renderizar al cambiar de ruta dentro de él, así
      // que sin esto la barra seguiría enseñando el emisor anterior aunque el
      // contenido ya fuera del nuevo.
      router.refresh();
    } finally {
      setCambiando(false);
    }
  }

  const etiqueta = activo ? activo.Nombre : "Todos los emisores";
  const debajo = activo ? activo.Rfc : `${emisores.length} emisores`;

  if (emisores.length === 0) return null;

  const cara = (
    <>
      <span
        className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-ink text-[9px] font-bold text-surface"
        aria-hidden
      >
        {activo ? iniciales(activo.Nombre) : "··"}
      </span>
      <span className="flex min-w-0 flex-col text-left leading-tight">
        <span className="truncate text-[11.5px] font-semibold text-ink">{etiqueta}</span>
        <span className="truncate text-[10px] text-ink-3">{debajo}</span>
      </span>
    </>
  );

  if (unico) {
    return (
      <div className="hidden max-w-[220px] items-center gap-2 rounded-[10px] border border-line px-2 py-1 md:flex">
        {cara}
      </div>
    );
  }

  return (
    <div ref={wrapRef} className="relative hidden md:block">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={cambiando}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "focus-brand flex max-w-[240px] items-center gap-2 rounded-[10px] border border-line px-2 py-1 transition",
          open ? "bg-surface-2" : "hover:bg-line-2",
          cambiando && "opacity-60"
        )}
      >
        {cara}
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={cx("shrink-0 text-ink-3 transition", open && "rotate-180")}
          aria-hidden
        >
          <path d="M1 3.5L5 7l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+8px)] max-h-[70vh] w-[320px] overflow-y-auto rounded-2xl border border-line bg-surface p-2 shadow-pop"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => elegir("")}
            className={cx(
              "focus-brand flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2",
              rfcActivo === "" && "bg-brand-050"
            )}
          >
            <span className="flex min-w-0 flex-col">
              <span
                className={cx(
                  "text-[13px] font-semibold",
                  rfcActivo === "" ? "text-brand-600" : "text-ink"
                )}
              >
                Todos los emisores
              </span>
              <span className="text-[11.5px] leading-snug text-ink-3">
                Para consultar. Para emitir hay que elegir uno.
              </span>
            </span>
          </button>

          <div className="my-1.5 border-t border-line-2" />

          {emisores.map((e) => (
            <button
              key={e.Rfc}
              type="button"
              role="menuitem"
              onClick={() => elegir(e.Rfc)}
              className={cx(
                "focus-brand flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition hover:bg-surface-2",
                e.Rfc === rfcActivo && "bg-brand-050"
              )}
            >
              <span
                className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-ink text-[10px] font-bold text-surface"
                aria-hidden
              >
                {iniciales(e.Nombre)}
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cx(
                    "truncate text-[13px] font-semibold",
                    e.Rfc === rfcActivo ? "text-brand-600" : "text-ink"
                  )}
                >
                  {e.Nombre}
                </span>
                <span className="truncate font-mono text-[11px] text-ink-3">{e.Rfc}</span>
              </span>
            </button>
          ))}

          <div className="mt-1.5 border-t border-line-2 pt-1.5">
            <Link
              href="/emisores"
              onClick={() => setOpen(false)}
              className="focus-brand block rounded-xl px-3 py-2 text-[12.5px] font-medium text-brand hover:bg-surface-2"
            >
              Administrar emisores
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
