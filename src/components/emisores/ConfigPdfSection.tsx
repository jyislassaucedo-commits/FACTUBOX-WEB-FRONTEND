"use client";

import { useEffect, useState } from "react";
import { CONFIG_PDF_DEFAULT, type ConfigPdfForm } from "@/lib/configPdfShared";
import { ConfigPdfEditor } from "./ConfigPdfEditor";

export function ConfigPdfSection({
  rfc,
  emisorNombre,
}: {
  rfc: string;
  emisorNombre: string;
}) {
  const [configs, setConfigs] = useState<ConfigPdfForm[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<ConfigPdfForm | null>(null);
  const [error, setError] = useState<string | null>(null);

  function cargar() {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`)
      .then((res) => res.json())
      .then((body) => setConfigs(body.configs ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, [rfc]);

  async function handleEliminar(nombre: string) {
    setError(null);
    const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre }),
    });
    const body = await res.json();

    if (!res.ok) {
      setError(body.error ?? "No se pudo eliminar la configuración");
      return;
    }
    cargar();
  }

  if (editando) {
    return (
      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">
          {editando.nombre ? `Diseño: ${editando.nombre}` : "Nuevo diseño de PDF"}
        </h2>
        <ConfigPdfEditor
          rfc={rfc}
          emisorNombre={emisorNombre}
          initial={editando}
          nombreBloqueado={configs.some((c) => c.nombre === editando.nombre)}
          onCancel={() => setEditando(null)}
          onSaved={() => {
            setEditando(null);
            cargar();
          }}
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900">
            Diseños del PDF de facturas
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Puedes tener varios diseños (con su propio logo) y elegir cuál usar al facturar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setEditando({ ...CONFIG_PDF_DEFAULT })}
          className="whitespace-nowrap rounded-lg border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-700 transition hover:bg-neutral-100"
        >
          Nueva configuración
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {loading ? (
        <p className="mt-4 text-sm text-neutral-500">Cargando...</p>
      ) : configs.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">Todavía no tienes ningún diseño.</p>
      ) : (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {configs.map((config) => (
            <div
              key={config.nombre}
              className="flex items-center justify-between rounded-lg border border-neutral-200 p-3"
            >
              <button
                type="button"
                onClick={() => setEditando(config)}
                className="flex items-center gap-3 text-left"
              >
                {config.imagenBase64 ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:image/png;base64,${config.imagenBase64}`}
                    alt=""
                    className="h-9 w-9 rounded object-contain"
                  />
                ) : (
                  <div className="h-9 w-9 rounded bg-neutral-100" />
                )}
                <div>
                  <p className="text-sm font-medium text-neutral-900">{config.nombre}</p>
                  <div className="mt-1 flex gap-1">
                    {[config.colorFondo, config.colorSeparador, config.colorTitulos].map(
                      (c, i) => (
                        <span
                          key={i}
                          className="h-3 w-3 rounded-full border border-neutral-200"
                          style={{ background: c }}
                        />
                      )
                    )}
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleEliminar(config.nombre)}
                className="text-xs font-medium text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
