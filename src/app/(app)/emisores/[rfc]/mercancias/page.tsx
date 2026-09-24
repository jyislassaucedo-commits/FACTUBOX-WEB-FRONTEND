import { MercanciasSection } from "@/components/cartaPorte/catalogos/Mercancias";
import { listarCatalogoCP } from "@/lib/cartaPorteCatalogos";
import type { MercanciaCP } from "@/lib/cartaPorteShared";

export default async function Page({ params }: { params: Promise<{ rfc: string }> }) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const inicial = (await listarCatalogoCP<MercanciaCP>(rfc, "mercancia")) ?? { total: 0, registros: [] };
  return <MercanciasSection rfc={rfc} inicial={inicial} />;
}
