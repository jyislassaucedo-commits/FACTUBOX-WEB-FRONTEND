import { MasivoSection } from "@/components/masivo/MasivoSection";
import { listarLotes } from "@/lib/masivo";
import { loadEmisorContext } from "@/lib/emisorData";
import type { ResumenLote } from "@/lib/masivoShared";

export default async function MasivoPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  // El historial se trae en el servidor para que la pantalla no llegue vacía.
  // Si falla, se entra igual: subir una plantilla nueva no depende de poder
  // leer los lotes de antes.
  const res = await listarLotes(rfc);
  const lotes: ResumenLote[] = "error" in res ? [] : (res.Lotes ?? []);

  return <MasivoSection rfc={rfc} lotesIniciales={lotes} />;
}
