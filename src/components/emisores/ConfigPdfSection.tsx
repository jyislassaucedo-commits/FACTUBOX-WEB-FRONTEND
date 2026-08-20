"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  useToast,
} from "@/components/ui";
import { CONFIG_PDF_DEFAULT, type ConfigPdfForm } from "@/lib/configPdfShared";
import { ConfigPdfEditor } from "./ConfigPdfEditor";

export function ConfigPdfSection({
  rfc,
  emisorNombre,
  configs,
}: {
  rfc: string;
  emisorNombre: string;
  configs: ConfigPdfForm[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [editando, setEditando] = useState<ConfigPdfForm | null>(null);
  const [borrando, setBorrando] = useState<string | null>(null);

  async function handleEliminar(nombre: string) {
    setBorrando(nombre);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/config-pdf`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre }),
      });
      const body = await res.json();

      if (!res.ok) {
        toast(body.error ?? "No se pudo eliminar la configuración", "danger");
        return;
      }
      toast("Diseño eliminado");
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  if (editando) {
    return (
      <Card>
        <CardHeader
          title={editando.nombre ? `Diseño: ${editando.nombre}` : "Nuevo diseño de PDF"}
          description="Los colores y opciones se aplican al PDF que se genera al timbrar."
          action={
            <Button variant="ghost" onClick={() => setEditando(null)}>
              Volver a la lista
            </Button>
          }
        />
        <CardBody>
          <ConfigPdfEditor
            rfc={rfc}
            emisorNombre={emisorNombre}
            initial={editando}
            nombreBloqueado={configs.some((c) => c.nombre === editando.nombre)}
            onCancel={() => setEditando(null)}
            onSaved={() => {
              setEditando(null);
              toast("Diseño guardado");
              router.refresh();
            }}
          />
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader
        title="Diseños del PDF de facturas"
        description="Puedes tener varios diseños (con su propio logo) y elegir cuál usar al facturar."
        action={
          <Button variant="primary" onClick={() => setEditando({ ...CONFIG_PDF_DEFAULT })}>
            Nueva configuración
          </Button>
        }
      />

      {configs.length === 0 ? (
        <EmptyState
          title="Todavía no tienes ningún diseño"
          description="Sin diseño propio, el PDF sale con el estilo base del sistema."
          action={
            <Button variant="primary" onClick={() => setEditando({ ...CONFIG_PDF_DEFAULT })}>
              Crear el primero
            </Button>
          }
        />
      ) : (
        <CardBody>
          <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
            {configs.map((config) => (
              <div
                key={config.nombre}
                className="group overflow-hidden rounded-xl border border-line bg-surface transition hover:-translate-y-0.5 hover:border-ink-4 hover:shadow-pop"
              >
                <button
                  type="button"
                  onClick={() => setEditando(config)}
                  className="focus-brand block w-full text-left"
                  aria-label={`Editar diseño ${config.nombre}`}
                >
                  <MiniaturaPdf config={config} />
                </button>
                <div className="flex items-center justify-between gap-2 border-t border-line-2 px-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-ink">
                      {config.nombre}
                    </p>
                    <div className="mt-1 flex gap-1" aria-hidden>
                      {[config.colorFondo, config.colorSeparador, config.colorTitulos].map(
                        (c, i) => (
                          <span
                            key={i}
                            className="h-2.5 w-2.5 rounded-full border border-line"
                            style={{ background: c }}
                          />
                        )
                      )}
                    </div>
                  </div>
                  <ConfirmButton
                    pending={borrando === config.nombre}
                    onConfirm={() => handleEliminar(config.nombre)}
                  />
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      )}
    </Card>
  );
}

/**
 * Boceto del PDF con los colores reales del diseño: da una idea del resultado
 * sin tener que generar el PDF completo (eso es el editor con PdfPreview).
 */
function MiniaturaPdf({ config }: { config: ConfigPdfForm }) {
  return (
    <div className="flex h-32 flex-col gap-1.5 bg-surface-2 p-3">
      <div className="flex items-start gap-2">
        {config.imagenBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${config.imagenBase64}`}
            alt=""
            className="h-6 w-12 rounded object-contain"
          />
        ) : (
          <span
            className="h-3.5 w-16 rounded-sm"
            style={{ background: config.colorTitulos }}
          />
        )}
        <span className="ml-auto h-2 w-10 rounded-sm bg-line" />
      </div>
      <span className="h-1.5 w-3/5 rounded-sm bg-line" />
      <span
        className="h-[3px] w-full rounded-sm"
        style={{ background: config.colorSeparador }}
      />
      <span className="h-1.5 w-full rounded-sm" style={{ background: config.colorFondo }} />
      <span className="h-1.5 w-11/12 rounded-sm bg-line" />
      <span className="h-1.5 w-4/5 rounded-sm bg-line" />
      <span
        className="mt-auto h-2 w-1/3 self-end rounded-sm"
        style={{ background: config.colorTitulos }}
      />
    </div>
  );
}
