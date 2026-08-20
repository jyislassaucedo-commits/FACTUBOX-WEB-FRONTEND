"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "factubox-theme";

type Tema = "light" | "dark";

/**
 * El estado "real" vive fuera de React: es el atributo `data-theme` en
 * <html>, que el script anti-parpadeo de layout.tsx ya deja correcto antes
 * de hidratar. useSyncExternalStore lo lee sin duplicarlo en un useState -y
 * de paso resuelve que el botón se renderiza dos veces (barra superior y
 * cajón móvil): alternar desde uno actualiza el ícono del otro, porque
 * ambos se suscriben al mismo store.
 */
const listeners = new Set<() => void>();

function leerTemaActual(): Tema {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): Tema {
  return "light";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function alternarTema() {
  const siguiente: Tema = leerTemaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = siguiente;
  localStorage.setItem(STORAGE_KEY, siguiente);
  listeners.forEach((notificar) => notificar());
}

export function ThemeToggle({ className }: { className?: string }) {
  const tema = useSyncExternalStore(subscribe, leerTemaActual, getServerSnapshot);

  return (
    <button
      type="button"
      onClick={alternarTema}
      className={
        className ??
        "focus-brand rounded-lg p-1.5 text-ink-2 transition hover:bg-line-2"
      }
      aria-label={tema === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={tema === "dark" ? "Tema claro" : "Tema oscuro"}
    >
      {tema === "dark" ? <SolIcon /> : <LunaIcon />}
    </button>
  );
}

function SolIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LunaIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path
        d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
