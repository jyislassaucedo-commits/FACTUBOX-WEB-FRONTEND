import { UbicacionesSection } from "@/components/cartaPorte/catalogos/Ubicaciones";
import { listarCatalogoCP } from "@/lib/cartaPorteCatalogos";
import type { UbicacionCP } from "@/lib/cartaPorteShared";

export default async function Page({ params }: { params: Promise<{ rfc: string }> }) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const inicial = (await listarCatalogoCP<UbicacionCP>(rfc, "ubicacion")) ?? { total: 0, registros: [] };
  return <UbicacionesSection rfc={rfc} inicial={inicial} />;
}
