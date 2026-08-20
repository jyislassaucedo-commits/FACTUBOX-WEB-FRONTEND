import { SeriesSection } from "@/components/emisores/SeriesSection";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function SeriesPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return <SeriesSection rfc={rfc} series={contexto.series} />;
}
