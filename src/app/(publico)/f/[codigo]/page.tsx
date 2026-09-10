import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { consultarAutofactura } from "@/lib/autofactura";
import { AutofacturaView } from "@/components/autofactura/AutofacturaView";

export const metadata: Metadata = {
  title: "Factura tu compra · Factubox",
  // Cada URL es un secreto de un comprador: que no la indexe nadie.
  robots: { index: false, follow: false },
};

/**
 * /f/{codigo}: la autofactura por QR.
 *
 * El comprador llega aquí desde el ticket o el correo, sin cuenta. Se
 * consulta la venta y se pinta según su estado; el formulario y el timbrado
 * viven en AutofacturaView (cliente).
 */
export default async function AutofacturaPage({
  params,
}: {
  params: Promise<{ codigo: string }>;
}) {
  const { codigo } = await params;
  const auto = await consultarAutofactura(codigo.toLowerCase());

  if (!auto) notFound();

  return <AutofacturaView inicial={auto} />;
}
