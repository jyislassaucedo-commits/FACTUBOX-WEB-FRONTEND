"use client";

import { useEffect, useRef, useState } from "react";
import { Button, cx, useToast, type ButtonVariant } from "@/components/ui";
import type { ConfigPdfForm } from "@/lib/configPdfShared";

/**
 * Botón "PDF" que, al abrirse, deja elegir con qué diseño (ConfigPdf) del
 * emisor generar el archivo - además de la opción de usar el que ya trae
 * la factura desde que se timbró.
 */
export function GenerarPdfMenu({
  rfc,
  uuid,
  size = "sm",
  variant = "ghost",
  label = "PDF",
}: {
  rfc: string;
  uuid: string;
  size?: "sm" | "md";
  variant?: ButtonVariant;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [configs, setConfigs] = useState<ConfigPdfForm[] | null>(null);
  const [cargando, setCargando] = useState(false);
  const [descargando, setDescargando] = useState<string | null>(null);
  const toast = useToast();
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

  async function abrir() {
    setOpen((v) => !v);
    if (configs !== null) return;
    setCargando(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`);
      const body = await res.json();
      setConfigs(body.configs ?? []);
    } finally {
      setCargando(false);
    }
  }

  async function descargar(idConfigPdf: string | undefined, etiquetaBoton: string) {
    setDescargando(etiquetaBoton);
    try {
      const query = idConfigPdf ? `?idConfigPdf=${encodeURIComponent(idConfigPdf)}` : "";
      const res = await fetch(`/api/facturas/${encodeURIComponent(uuid)}/pdf${query}`);
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo generar el PDF", "danger");
        return;
      }
      const bytes = Uint8Array.from(atob(body.base64), (c) => c.charCodeAt(0));
      const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${uuid}.pdf`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    } finally {
      setDescargando(null);
      setOpen(false);
    }
  }

  return (
    <div ref={wrapRef} className="relative inline-block">
      <Button
        variant={variant}
        size={size}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={abrir}
      >
        {label}
      </Button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+4px)] z-30 w-64 rounded-xl border border-line bg-surface p-1.5 shadow-pop"
        >
          <p className="px-2.5 pb-1.5 pt-1 text-[10.5px] font-bold uppercase tracking-[0.08em] text-ink-4">
            Generar PDF con...
          </p>

          <button
            type="button"
            role="menuitem"
            disabled={descargando !== null}
            onClick={() => descargar(undefined, "__default__")}
            className={cx(
              "focus-brand block w-full rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-ink transition hover:bg-surface-2",
              descargando === "__default__" && "opacity-60"
            )}
          >
            {descargando === "__default__" ? "Generando…" : "El diseño de esta factura"}
          </button>

          {cargando && (
            <p className="px-2.5 py-2 text-[12.5px] text-ink-3">Cargando diseños…</p>
          )}

          {configs && configs.length > 0 && (
            <div className="mt-1 border-t border-line-2 pt-1">
              {configs.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  role="menuitem"
                  disabled={descargando !== null}
                  onClick={() => descargar(c.id, c.id ?? c.nombre)}
                  className={cx(
                    "focus-brand block w-full truncate rounded-lg px-2.5 py-1.5 text-left text-[13px] text-ink-2 transition hover:bg-surface-2",
                    descargando === (c.id ?? c.nombre) && "opacity-60"
                  )}
                >
                  {descargando === (c.id ?? c.nombre) ? "Generando…" : c.nombre}
                </button>
              ))}
            </div>
          )}

          {configs && configs.length === 0 && !cargando && (
            <p className="px-2.5 py-2 text-[12.5px] text-ink-3">
              Este emisor no tiene diseños guardados.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
