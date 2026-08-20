"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { EmisorForm } from "@/components/emisores/EmisorForm";
import { CsdSection } from "@/components/emisores/CsdSection";
import { ConfigPdfSection } from "@/components/emisores/ConfigPdfSection";
import { SeriesSection } from "@/components/emisores/SeriesSection";
import type { EmisorDetalle, EmisorInput } from "@/lib/emisores";

export default function EmisorDetallePage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc } = use(params);
  const router = useRouter();
  const [emisor, setEmisor] = useState<EmisorDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [sugerenciaNombre, setSugerenciaNombre] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/empresas/${encodeURIComponent(rfc)}`)
      .then((res) => res.json())
      .then((body) => setEmisor(body.emisor ?? null))
      .finally(() => setLoading(false));
  }, [rfc]);

  async function handleSubmit(values: EmisorInput): Promise<string | null> {
    const res = await fetch("/api/empresas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const body = await res.json();

    if (!res.ok) {
      return body.error ?? "No se pudo guardar el emisor";
    }

    router.refresh();
    return null;
  }

  if (loading) {
    return <p className="text-sm text-neutral-500">Cargando...</p>;
  }

  if (!emisor) {
    return (
      <p className="text-sm text-neutral-500">
        No se encontró este emisor, o no te pertenece.
      </p>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">{emisor.Nombre}</h1>
        <p className="mt-1 text-sm text-neutral-600">{emisor.Rfc}</p>
      </div>

      <div className="rounded-xl border border-neutral-200 bg-white p-4">
        <h2 className="mb-4 text-sm font-semibold text-neutral-900">Datos generales</h2>

        {sugerenciaNombre && sugerenciaNombre !== emisor.Nombre && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-800">
            <span>El certificado indica la razón social: “{sugerenciaNombre}”.</span>
            <button
              type="button"
              onClick={() => {
                setEmisor({ ...emisor, Nombre: sugerenciaNombre });
                setSugerenciaNombre(null);
              }}
              className="whitespace-nowrap font-medium underline"
            >
              Usar este nombre
            </button>
          </div>
        )}

        <EmisorForm
          key={emisor.Nombre}
          initial={{
            rfc: emisor.Rfc,
            nombre: emisor.Nombre,
            regimenFiscal: emisor.Regimen,
            domicilioFiscal: emisor.LugarExp,
          }}
          rfcEditable={false}
          onSubmit={handleSubmit}
        />
      </div>

      <CsdSection
        rfc={emisor.Rfc}
        token={emisor.Token}
        vigenciaActual={emisor.VigenciaCert}
        tieneCsd={emisor.InicioCert !== "NA"}
        onUploaded={(vigencia) =>
          setEmisor({ ...emisor, VigenciaCert: vigencia, InicioCert: vigencia })
        }
        onRazonSocial={setSugerenciaNombre}
      />

      <SeriesSection rfc={emisor.Rfc} />

      <ConfigPdfSection rfc={emisor.Rfc} emisorNombre={emisor.Nombre} />
    </div>
  );
}
