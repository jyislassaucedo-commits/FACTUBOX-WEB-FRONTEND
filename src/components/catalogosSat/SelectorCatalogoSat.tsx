"use client";

import { useEffect, useRef, useState } from "react";
import { cx, inputClass } from "@/components/ui";

interface OpcionBase {
  id: string;
  texto: string;
}

/**
 * Como BuscadorClaveSat, pero sobre una lista ya cargada en memoria (por
 * useCatalogoSat) en vez de pedir al servidor por cada letra - tiene sentido
 * para catálogos chicos como RegimenFiscal (19) o UsoCFDI (24), donde
 * filtrar en el cliente es instantáneo y no vale la pena el round-trip.
 */
export function SelectorCatalogoSat<T extends OpcionBase>({
  opciones,
  value,
  placeholder,
  invalid,
  required,
  onChange,
}: {
  opciones: T[];
  value: string;
  placeholder?: string;
  invalid?: boolean;
  required?: boolean;
  onChange: (opcion: T) => void;
}) {
  const seleccionada = opciones.find((o) => o.id === value);
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState("");
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function alHacerClicFuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
        setTexto("");
      }
    }
    document.addEventListener("mousedown", alHacerClicFuera);
    return () => document.removeEventListener("mousedown", alHacerClicFuera);
  }, []);

  const query = texto.trim().toLowerCase();
  const filtradas = query
    ? opciones.filter(
        (o) => o.id.toLowerCase().includes(query) || o.texto.toLowerCase().includes(query)
      )
    : opciones;

  return (
    <div ref={contenedorRef} className="relative">
      <input
        className={inputClass}
        placeholder={placeholder}
        value={abierto ? texto : seleccionada ? `${seleccionada.id} - ${seleccionada.texto}` : ""}
        aria-invalid={invalid}
        required={required}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={() => {
          setAbierto(true);
          setTexto("");
        }}
      />

      {abierto && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-[10px] border border-line bg-surface shadow-lg">
          {filtradas.length === 0 ? (
            <p className="px-3 py-2 text-[12.5px] text-ink-4">Sin resultados.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {filtradas.map((o) => (
                <li key={o.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(o);
                      setAbierto(false);
                      setTexto("");
                    }}
                    className={cx(
                      "focus-brand block w-full px-3 py-2 text-left text-[12.5px] hover:bg-surface-2",
                      o.id === value && "bg-surface-2"
                    )}
                  >
                    <span className="font-mono font-semibold text-ink">{o.id}</span>
                    <span className="text-ink-3"> - {o.texto}</span>
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
