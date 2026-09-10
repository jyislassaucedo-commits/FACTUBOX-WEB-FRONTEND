import { NuevaAutofacturaForm } from "@/components/autofacturas/NuevaAutofacturaForm";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function NuevaAutofacturaPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return <NuevaAutofacturaForm rfc={rfc} series={contexto.series} />;
}
