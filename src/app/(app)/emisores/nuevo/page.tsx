"use client";

import { useRouter } from "next/navigation";
import { EmisorForm } from "@/components/emisores/EmisorForm";
import type { EmisorInput } from "@/lib/emisores";

export default function NuevoEmisorPage() {
  const router = useRouter();

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

    router.push(`/emisores/${encodeURIComponent(values.rfc)}`);
    return null;
  }

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900">Nuevo emisor</h1>
        <p className="mt-1 text-sm text-neutral-600">
          Después de guardar podrás subir su certificado y configurar el PDF.
        </p>
      </div>

      <EmisorForm
        initial={{ rfc: "", nombre: "", regimenFiscal: "", domicilioFiscal: "" }}
        rfcEditable
        onSubmit={handleSubmit}
      />
    </div>
  );
}
