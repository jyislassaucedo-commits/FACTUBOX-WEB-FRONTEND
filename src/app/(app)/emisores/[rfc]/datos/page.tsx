import { DatosGeneralesSection } from "@/components/emisores/DatosGeneralesSection";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function DatosGeneralesPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc } = await params;
  const contexto = await loadEmisorContext(decodeURIComponent(rfc));
  if (!contexto) return null;

  return <DatosGeneralesSection emisor={contexto.emisor} />;
}
