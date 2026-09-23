import { NuevaAutofacturaForm } from "@/components/autofacturas/NuevaAutofacturaForm";
import { loadEmisorContext } from "@/lib/emisorData";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

export default async function NuevaAutofacturaPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una autofactura" />;

  // Sigue haciendo falta el contexto por las series: el enlace se emite con una
  // serie concreta y el formulario tiene que ofrecerlas.
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return <NuevaAutofacturaForm rfc={rfc} series={contexto.series} />;
}
