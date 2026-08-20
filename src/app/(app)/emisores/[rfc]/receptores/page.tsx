import { ReceptoresSection } from "@/components/receptores/ReceptoresSection";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function ReceptoresPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return <ReceptoresSection rfc={rfc} receptores={contexto.receptores} />;
}
