import { PrenominasSection } from "@/components/nomina/manual/PrenominasSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPrenominas } from "@/lib/nominaManual";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

export default async function PrenominasPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una prenómina" />;

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const prenominas = await getPrenominas(rfc);
  return <PrenominasSection rfc={rfc} prenominas={prenominas} />;
}
