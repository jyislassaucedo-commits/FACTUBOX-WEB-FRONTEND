import { LotesLista } from "@/components/masivo/LotesLista";
import { listarLotes } from "@/lib/masivo";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";
import type { ResumenLote } from "@/lib/masivoShared";

/**
 * Los lotes del emisor activo. Subir una plantilla ya no vive aquí: es una
 * opción del asistente de nueva factura, porque es otra forma de capturar el
 * mismo comprobante, no otra sección.
 */
export default async function LotesPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Un lote de comprobantes" />;

  // Si falla la consulta se entra igual, con la lista vacía: desde aquí se
  // manda al asistente, y eso no depende de poder leer los lotes de antes.
  const res = await listarLotes(rfc);
  const lotes: ResumenLote[] = "error" in res ? [] : (res.Lotes ?? []);

  return <LotesLista lotes={lotes} />;
}
