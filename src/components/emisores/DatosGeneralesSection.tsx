"use client";

import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, useToast } from "@/components/ui";
import { EmisorForm } from "@/components/emisores/EmisorForm";
import type { EmisorDetalle, EmisorInput } from "@/lib/emisores";

export function DatosGeneralesSection({ emisor }: { emisor: EmisorDetalle }) {
  const router = useRouter();
  const toast = useToast();

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

    toast("Datos generales guardados");
    // Vuelve a ejecutar el layout del emisor: refresca hero, contadores y
    // el propio formulario con los valores que quedaron en el backend.
    router.refresh();
    return null;
  }

  return (
    <Card>
      <CardHeader
        title="Identidad fiscal"
        description="Debe coincidir exactamente con tu Constancia de Situación Fiscal: esto viaja en cada CFDI que emitas."
      />
      <CardBody>
        <EmisorForm
          key={`${emisor.Nombre}-${emisor.Regimen}-${emisor.LugarExp}`}
          initial={{
            rfc: emisor.Rfc,
            nombre: emisor.Nombre,
            regimenFiscal: emisor.Regimen,
            domicilioFiscal: emisor.LugarExp,
          }}
          rfcEditable={false}
          logoActual={emisor.Logo || undefined}
          onSubmit={handleSubmit}
        />
      </CardBody>
    </Card>
  );
}
