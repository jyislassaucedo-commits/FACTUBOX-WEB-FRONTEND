"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogoutButton } from "@/components/LogoutButton";
import type { CurrentUser } from "@/lib/currentUser";

const NAV_ITEMS = [
  { href: "/", label: "Inicio" },
  { href: "/emisores", label: "Emisores" },
  { href: "/facturas", label: "Facturas" },
];

export function AppShell({
  user,
  children,
}: {
  user: CurrentUser;
  children: React.ReactNode;
}) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Barra superior: siempre visible, trae el boton de menu en movil */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-neutral-200 bg-white px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100 md:hidden"
            aria-label="Abrir menú"
          >
            <MenuIcon />
          </button>
          <Image
            src="/factubox-logo.png"
            alt="Factubox"
            width={4705}
            height={960}
            className="h-6 w-auto"
            priority
          />
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <span className="text-sm text-neutral-600">{user.Nombre}</span>
          <LogoutButton />
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl">
        {/* Sidebar: fija en escritorio */}
        <aside className="hidden w-56 shrink-0 border-r border-neutral-200 bg-white p-4 md:block">
          <Nav pathname={pathname} />
        </aside>

        {/* Drawer: solo en movil */}
        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div
              className="absolute inset-0 bg-black/30"
              onClick={() => setMobileNavOpen(false)}
            />
            <div className="absolute left-0 top-0 h-full w-64 bg-white p-4 shadow-lg">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-neutral-900">
                  Menú
                </span>
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(false)}
                  className="rounded-md p-1.5 text-neutral-600 hover:bg-neutral-100"
                  aria-label="Cerrar menú"
                >
                  <CloseIcon />
                </button>
              </div>
              <Nav pathname={pathname} onNavigate={() => setMobileNavOpen(false)} />
              <div className="mt-6 border-t border-neutral-200 pt-4">
                <p className="mb-2 text-sm text-neutral-600">{user.Nombre}</p>
                <LogoutButton />
              </div>
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}

function Nav({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="space-y-1">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            className={`block rounded-lg px-3 py-2 text-sm font-medium transition ${
              active
                ? "bg-[var(--brand)] text-[var(--brand-ink)]"
                : "text-neutral-700 hover:bg-neutral-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
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
