"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import { ToastProvider, cx } from "@/components/ui";
import { EMISOR_SECTIONS, emisorHref, iniciales } from "@/lib/emisorNav";
import { TimbresBadge } from "@/components/TimbresBadge";
import type { CurrentUser } from "@/lib/currentUser";
import type { Timbres } from "@/lib/timbresShared";

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/emisores", label: "Emisores" },
  { href: "/facturas", label: "Facturas" },
];

/** RFC del emisor abierto, si el pathname es /emisores/<rfc>/... */
function rfcDelPathname(pathname: string): string | null {
  const m = /^\/emisores\/([^/]+)/.exec(pathname);
  if (!m || m[1] === "nuevo") return null;
  return decodeURIComponent(m[1]);
}

export function AppShell({
  user,
  timbres,
  children,
}: {
  user: CurrentUser;
  /** Saldo de timbres de la cuenta; null si no se pudo consultar. */
  timbres: Timbres | null;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();
  const rfcActual = rfcDelPathname(pathname);

  return (
    <ToastProvider>
      <div className="min-h-screen bg-bg">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-line bg-surface/85 px-4 backdrop-blur-md md:px-6">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="focus-brand rounded-lg p-1.5 text-ink-2 transition hover:bg-line-2 md:hidden"
            aria-label="Abrir menú"
          >
            <MenuIcon />
          </button>

          <Link href="/" className="focus-brand shrink-0 rounded">
            <Image
              src="/factubox-logo.png"
              alt="Factubox"
              width={4705}
              height={960}
              className="h-6 w-auto"
              priority
            />
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_ITEMS.map((item) =>
              item.href === "/emisores" ? (
                <EmisoresMenu key={item.href} pathname={pathname} rfcActual={rfcActual} />
              ) : (
                <TopLink
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  active={
                    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
                  }
                />
              )
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            {timbres && <TimbresBadge timbres={timbres} />}
          </div>

          <div className="hidden items-center gap-2 md:flex">
            <span className="flex items-center gap-2 rounded-full border border-line py-1 pl-1 pr-3">
              <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[11px] font-bold text-background">
                {iniciales(user.Nombre)}
              </span>
              <span className="text-xs font-medium text-ink-2">{user.Nombre}</span>
            </span>
            <LogoutButton />
          </div>
        </header>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/40"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-72 overflow-y-auto bg-surface p-4 shadow-pop">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink">Menú</span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="focus-brand rounded-lg p-1.5 text-ink-2 hover:bg-line-2"
                  aria-label="Cerrar menú"
                >
                  <CloseIcon />
                </button>
              </div>

              <nav className="space-y-1">
                {NAV_ITEMS.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileNavOpen(false)}
                    className={cx(
                      "block rounded-[10px] px-3 py-2 text-sm font-medium transition",
                      (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href))
                        ? "bg-brand-050 text-brand-600"
                        : "text-ink-2 hover:bg-line-2"
                    )}
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              {rfcActual && (
                <div className="mt-5 border-t border-line pt-4">
                  <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-4">
                    {rfcActual}
                  </p>
                  <nav className="space-y-1">
                    {EMISOR_SECTIONS.map((section) => (
                      <Link
                        key={section.key}
                        href={emisorHref(rfcActual, section.segment)}
                        onClick={() => setMobileNavOpen(false)}
                        className="block rounded-[10px] px-3 py-2 text-sm font-medium text-ink-2 transition hover:bg-line-2"
                      >
                        {section.label}
                      </Link>
                    ))}
                  </nav>
                </div>
              )}

              <div className="mt-6 border-t border-line pt-4">
                <p className="mb-2 text-sm text-ink-2">{user.Nombre}</p>
                {timbres && (
                  <p className="mb-3 text-[12.5px] text-ink-3">
                    <span className="font-mono font-semibold text-ink">
                      {timbres.disponibles}
                    </span>{" "}
                    timbres disponibles
                  </p>
                )}
                <LogoutButton />
              </div>
            </div>
          </div>
        )}

        <main className="mx-auto min-w-0 max-w-[1480px] p-4 md:p-6">{children}</main>
      </div>
    </ToastProvider>
  );
}

function TopLink({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "focus-brand rounded-[10px] px-3 py-1.5 text-sm font-medium transition",
        active ? "bg-brand-050 text-brand-600" : "text-ink-2 hover:bg-line-2 hover:text-ink"
      )}
    >
      {label}
    </Link>
  );
}

/**
 * "Emisores" en la barra superior es un dropdown: si hay un emisor abierto,
 * lista sus secciones (receptores, series y folios, disenos...) para saltar
 * directo sin pasar por la pantalla del emisor.
 */
function EmisoresMenu({
  pathname,
  rfcActual,
}: {
  pathname: string;
  rfcActual: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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

  const active = pathname.startsWith("/emisores");

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cx(
          "focus-brand flex items-center gap-1.5 rounded-[10px] px-3 py-1.5 text-sm font-medium transition",
          active ? "bg-brand-050 text-brand-600" : "text-ink-2 hover:bg-line-2 hover:text-ink"
        )}
      >
        Emisores
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={cx("transition", open && "rotate-180")}
          aria-hidden
        >
          <path d="M1 3.5L5 7l4-3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-[calc(100%+8px)] w-[520px] rounded-2xl border border-line bg-surface p-2.5 shadow-pop"
        >
          <div className="flex items-center justify-between border-b border-line-2 px-2 pb-2.5">
            <span className="truncate text-[11px] font-bold uppercase tracking-[0.08em] text-ink-3">
              {rfcActual ?? "Todos los emisores"}
            </span>
            <Link
              href="/emisores"
              onClick={() => setOpen(false)}
              className="focus-brand rounded px-2 py-1 text-xs font-medium text-brand hover:underline"
            >
              {rfcActual ? "Cambiar emisor" : "Ver lista"}
            </Link>
          </div>

          {rfcActual ? (
            <div className="mt-1.5 grid grid-cols-2 gap-1">
              {EMISOR_SECTIONS.map((section) => (
                <Link
                  key={section.key}
                  href={emisorHref(rfcActual, section.segment)}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className="focus-brand rounded-xl px-3 py-2.5 transition hover:bg-surface-2"
                >
                  <span className="block text-[13px] font-semibold text-ink">
                    {section.label}
                  </span>
                  <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-3">
                    {section.description}
                  </span>
                </Link>
              ))}
            </div>
          ) : (
            <p className="px-3 py-4 text-[13px] text-ink-3">
              Abre un emisor para saltar directo a sus receptores, series o diseños.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 6h18M3 12h18M3 18h18" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
    </svg>
  );
}
