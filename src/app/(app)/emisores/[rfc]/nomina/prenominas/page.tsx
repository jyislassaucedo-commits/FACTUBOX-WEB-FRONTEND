import { PrenominasSection } from "@/components/nomina/manual/PrenominasSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPrenominas } from "@/lib/nominaManual";

export default async function PrenominasPage({ params }: { params: Promise<{ rfc: string }> }) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const prenominas = await getPrenominas(rfc);
  return <PrenominasSection rfc={rfc} prenominas={prenominas} />;
}
