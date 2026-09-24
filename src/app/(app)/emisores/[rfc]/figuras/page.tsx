import { FigurasSection } from "@/components/cartaPorte/catalogos/Figuras";
import { listarCatalogoCP } from "@/lib/cartaPorteCatalogos";
import type { FiguraCP } from "@/lib/cartaPorteShared";

export default async function Page({ params }: { params: Promise<{ rfc: string }> }) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const inicial = (await listarCatalogoCP<FiguraCP>(rfc, "figura")) ?? { total: 0, registros: [] };
  return <FigurasSection rfc={rfc} inicial={inicial} />;
}
