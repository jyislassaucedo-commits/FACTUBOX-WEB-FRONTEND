"use client";

import { useEffect, useRef, useState } from "react";
import { cx, inputClass } from "@/components/ui";
import type { CatalogoBuscable } from "@/lib/catalogoSatBusqueda";

interface ResultadoBase {
  id: string;
  texto: string;
}

/**
 * Autocompleta un campo de clave del SAT (producto/servicio, unidad de
 * medida) buscando en vivo contra /api/catalogos/buscar. El campo sigue
 * aceptando la clave a mano - el usuario puede escribirla y seguir de
 * frente sin elegir nada de la lista, esto solo ayuda a encontrarla.
 */
export function BuscadorClaveSat<T extends ResultadoBase>({
  catalogo,
  valorId,
  valorTexto,
  placeholder,
  invalid,
  onEscribir,
  onElegir,
}: {
  catalogo: CatalogoBuscable;
  /** Clave actual (lo que se guarda en el borrador). */
  valorId: string;
  /** Descripción actual, si ya se eligió una opción del catálogo. */
  valorTexto?: string;
  placeholder?: string;
  invalid?: boolean;
  /** El usuario escribió directamente (clave a mano, sin elegir de la lista). */
  onEscribir: (valor: string) => void;
  onElegir: (resultado: T) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [resultados, setResultados] = useState<T[]>([]);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  useEffect(() => {
    if (!abierto || valorId.trim().length < 3) {
      setResultados([]);
      return;
    }
    let vivo = true;
    setCargando(true);
    const manija = setTimeout(() => {
      const params = new URLSearchParams({ catalogo, q: valorId });
      fetch(`/api/catalogos/buscar?${params.toString()}`)
        .then((res) => res.json())
        .then((body) => {
          if (vivo) setResultados(body.resultados ?? []);
        })
        .catch(() => {
          if (vivo) setResultados([]);
        })
        .finally(() => {
          if (vivo) setCargando(false);
        });
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(manija);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, catalogo, valorId]);

  return (
    <div ref={contenedorRef} className="relative">
      <input
        className={cx(inputClass, "font-mono")}
        placeholder={placeholder}
        value={valorId}
        aria-invalid={invalid}
        onChange={(e) => {
          onEscribir(e.target.value);
          setAbierto(true);
        }}
        onFocus={() => setAbierto(true)}
      />
      {valorTexto && (
        <p className="mt-1 truncate text-[11.5px] text-ink-3">{valorTexto}</p>
      )}

      {abierto && valorId.trim().length >= 3 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-[10px] border border-line bg-surface shadow-lg">
          {cargando ? (
            <p className="px-3 py-2 text-[12.5px] text-ink-4">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-[12.5px] text-ink-4">
              Sin resultados. Puedes dejar la clave escrita a mano.
            </p>
          ) : (
            <ul className="divide-y divide-line-2">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onElegir(r);
                      setAbierto(false);
                    }}
                    className="focus-brand block w-full px-3 py-2 text-left text-[12.5px] hover:bg-surface-2"
                  >
                    <span className="font-mono font-semibold text-ink">{r.id}</span>
                    <span className="text-ink-3"> - {r.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
