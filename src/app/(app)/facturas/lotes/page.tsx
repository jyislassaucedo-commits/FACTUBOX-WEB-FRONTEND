import { MasivoSection } from "@/components/masivo/MasivoSection";
import { listarLotes } from "@/lib/masivo";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";
import type { ResumenLote } from "@/lib/masivoShared";

export default async function LotesPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Un lote de comprobantes" />;

  // El historial se trae en el servidor para que la pantalla no llegue vacía.
  // Si falla, se entra igual: subir una plantilla nueva no depende de poder
  // leer los lotes de antes.
  const res = await listarLotes(rfc);
  const lotes: ResumenLote[] = "error" in res ? [] : (res.Lotes ?? []);

  return <MasivoSection rfc={rfc} lotesIniciales={lotes} />;
}
