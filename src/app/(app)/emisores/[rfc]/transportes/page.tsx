import { TransportesSection } from "@/components/cartaPorte/catalogos/Transportes";
import { listarCatalogoCP } from "@/lib/cartaPorteCatalogos";
import type { TransporteCP } from "@/lib/cartaPorteShared";

export default async function Page({ params }: { params: Promise<{ rfc: string }> }) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const inicial = (await listarCatalogoCP<TransporteCP>(rfc, "transporte")) ?? { total: 0, registros: [] };
  return <TransportesSection rfc={rfc} inicial={inicial} />;
}
