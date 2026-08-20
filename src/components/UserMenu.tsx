"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { useLogout } from "@/components/LogoutButton";
import { CopyButton, Pill, cx } from "@/components/ui";
import type { CurrentUser } from "@/lib/currentUser";

/**
 * Chip del usuario en la barra superior. Al hacer clic abre un panel con la
 * identidad completa en vez de navegar directo a /cuenta.
 *
 * Por que un panel y no un enlace: el chip mostraba el nombre truncado y nada
 * mas, asi que la unica forma de confirmar CON QUE cuenta estabas trabajando
 * era abrir la pantalla completa y perder lo que estuvieras haciendo. Es una
 * pregunta de un segundo ("soy yo, es mi correo") y ahora se responde sin
 * salir de la pagina. Editar sigue estando a un clic, en "Detalles".
 *
 * El IMEI esta aqui porque es el otro dato que la gente necesita leer en voz
 * alta cuando llama a soporte, y hasta hoy solo se podia ver abriendo la app
 * de escritorio.
 */
export function UserMenu({ user }: { user: CurrentUser }) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const botonRef = useRef<HTMLButtonElement>(null);
  const pathname = usePathname();
  const { logout, saliendo } = useLogout();

  const enCuenta = pathname.startsWith("/cuenta");

  // Mismo patron que EmisoresMenu: cerrar al hacer clic fuera o con Escape.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      setOpen(false);
      // Con Escape el foco tiene que volver al disparador; si no, queda en el
      // body y el siguiente Tab reinicia el recorrido desde el logo.
      botonRef.current?.focus();
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // No hay efecto que cierre el panel al cambiar de ruta: cada elemento que
  // navega ya llama a setOpen(false) en su onClick, que es donde corresponde.
  // Un efecto sobre pathname seria un setState en cascada por cada navegacion
  // de la app, para un caso que ya esta cubierto.

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={botonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        title={user.Email}
        className={cx(
          "focus-brand flex max-w-[220px] items-center gap-2 rounded-full border py-1 pl-1 pr-2.5 transition",
          open || enCuenta ? "border-brand bg-brand-050" : "border-line hover:bg-line-2"
        )}
      >
        <Avatar src={user.ImagenUrl} nombre={user.Nombre} size="sm" />
        <span
          className={cx(
            "truncate text-xs font-medium",
            open || enCuenta ? "text-brand-600" : "text-ink-2"
          )}
        >
          {user.Nombre}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={cx("shrink-0 transition", open && "rotate-180")}
          aria-hidden
        >
          <path
            d="M1 3.5L5 7l4-3.5"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Cuenta"
          className="absolute right-0 top-[calc(100%+8px)] w-[304px] rounded-2xl border border-line bg-surface p-3 shadow-pop"
        >
          <div className="flex flex-col items-center gap-2 px-2 pb-3 text-center">
            <Avatar src={user.ImagenUrl} nombre={user.Nombre} size="lg" />
            <div className="min-w-0 max-w-full">
              <p className="truncate text-[14.5px] font-semibold leading-snug text-ink">
                {user.Nombre}
              </p>
              <p className="truncate text-[12px] leading-snug text-ink-3">{user.Email}</p>
            </div>
            {user.EsSubusuario === "SI" && (
              <Pill tone="neutral">Subusuario de {user.Rfc}</Pill>
            )}
          </div>

          <DatoCopiable
            etiqueta="IMEI de la licencia"
            valor={user.Imei ?? null}
            vacio="Esta cuenta no tiene licencia registrada"
          />

          <div className="mt-2.5 space-y-0.5 border-t border-line-2 pt-2.5">
            <Link
              href="/cuenta"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="focus-brand flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink"
            >
              <IconoDetalles />
              Detalles de la cuenta
            </Link>

            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={saliendo}
              className="focus-brand flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-ink-2 transition hover:bg-surface-2 hover:text-ink disabled:opacity-60"
            >
              <IconoSalir />
              {saliendo ? "Saliendo..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Fila de dato de solo lectura con boton de copiar.
 *
 * Cuando no hay valor se muestra igual, en gris y sin boton, en vez de
 * esconder la fila: que el renglon del IMEI desaparezca sin explicacion se lee
 * como un error de la pagina, no como "no hay licencia".
 */
function DatoCopiable({
  etiqueta,
  valor,
  vacio,
}: {
  etiqueta: string;
  valor: string | null;
  vacio: string;
}) {
  return (
    <div className="border-t border-line-2 pt-2.5">
      <p className="px-1 pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-4">
        {etiqueta}
      </p>
      {valor ? (
        <CopyButton value={valor} className="w-full justify-between" />
      ) : (
        <p className="px-1 text-[12px] leading-snug text-ink-4">{vacio}</p>
      )}
    </div>
  );
}

/** Version compacta del panel para el cajon movil, que ya esta desplegado. */
export function UserMenuMovil({
  user,
  onNavegar,
}: {
  user: CurrentUser;
  onNavegar: () => void;
}) {
  const pathname = usePathname();
  const enCuenta = pathname.startsWith("/cuenta");

  return (
    <div>
      <Link
        href="/cuenta"
        onClick={onNavegar}
        className={cx(
          "mb-3 flex items-center gap-2.5 rounded-[10px] px-3 py-2 transition",
          enCuenta ? "bg-brand-050 text-brand-600" : "text-ink-2 hover:bg-line-2"
        )}
      >
        <Avatar src={user.ImagenUrl} nombre={user.Nombre} size="md" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{user.Nombre}</span>
          <span className="block truncate text-[11.5px] text-ink-4">{user.Email}</span>
        </span>
      </Link>

      {user.Imei && (
        <div className="mb-3 px-1">
          <p className="pb-1.5 text-[10.5px] font-bold uppercase tracking-[0.09em] text-ink-4">
            IMEI de la licencia
          </p>
          <CopyButton value={user.Imei} className="w-full justify-between" />
        </div>
      )}
    </div>
  );
}

function IconoDetalles() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="shrink-0"
      aria-hidden
    >
      <circle cx="12" cy="8" r="3.4" />
      <path d="M4.5 20c0-3.6 3.4-6 7.5-6s7.5 2.4 7.5 6" strokeLinecap="round" />
    </svg>
  );
}

function IconoSalir() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="shrink-0"
      aria-hidden
    >
      <path d="M15 4h3a2 2 0 012 2v12a2 2 0 01-2 2h-3" strokeLinecap="round" />
      <path d="M10 8l-4 4 4 4M6 12h9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
