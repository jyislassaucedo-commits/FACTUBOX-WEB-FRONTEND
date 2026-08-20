"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardBody, CardHeader } from "@/components/ui";
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
    <div className="mx-auto max-w-3xl space-y-4">
      <nav className="flex items-center gap-1.5 text-[12.5px] text-ink-3">
        <Link href="/emisores" className="focus-brand rounded hover:text-brand">
          Emisores
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-ink-2">Nuevo emisor</span>
      </nav>

      <Card>
        <CardHeader
          title="Nuevo emisor"
          description="Después de guardar podrás subir su certificado, crear series y configurar el PDF."
        />
        <CardBody>
          <EmisorForm
            initial={{ rfc: "", nombre: "", regimenFiscal: "", domicilioFiscal: "" }}
            rfcEditable
            onSubmit={handleSubmit}
          />
        </CardBody>
      </Card>
    </div>
  );
}
