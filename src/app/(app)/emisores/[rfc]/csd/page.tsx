import { CsdSection } from "@/components/emisores/CsdSection";
import { loadEmisorContext } from "@/lib/emisorData";

export default async function CsdPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const { emisor, tieneCsd } = contexto;

  return (
    <CsdSection
      rfc={rfc}
      token={emisor.Token}
      vigenciaActual={emisor.VigenciaCert}
      inicioCert={emisor.InicioCert}
      tieneCsd={tieneCsd}
      regimen={emisor.Regimen}
      lugarExp={emisor.LugarExp}
    />
  );
}
