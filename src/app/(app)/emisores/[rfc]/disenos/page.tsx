import { ConfigPdfSection } from "@/components/emisores/ConfigPdfSection";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function DisenosPdfPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return (
    <ConfigPdfSection
      rfc={rfc}
      emisorNombre={contexto.emisor.Nombre}
      configs={contexto.configs}
    />
  );
}
