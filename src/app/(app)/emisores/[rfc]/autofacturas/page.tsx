import { AutofacturasSection } from "@/components/autofacturas/AutofacturasSection";
import { getAutofacturas } from "@/lib/autofacturasEmisor";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function AutofacturasPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const autofacturas = await getAutofacturas(rfc);
  return <AutofacturasSection rfc={rfc} autofacturas={autofacturas} />;
}
