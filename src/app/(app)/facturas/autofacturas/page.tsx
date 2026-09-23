import { AutofacturasSection } from "@/components/autofacturas/AutofacturasSection";
import { getAutofacturas } from "@/lib/autofacturasEmisor";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

export default async function AutofacturasPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una autofactura" />;

  const autofacturas = await getAutofacturas(rfc);
  return <AutofacturasSection rfc={rfc} autofacturas={autofacturas} />;
}
