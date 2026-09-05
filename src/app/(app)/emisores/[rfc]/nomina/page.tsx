import { NominaSection } from "@/components/nomina/NominaSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPeriodos } from "@/lib/nomina";

export default async function NominaPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  return (
    <NominaSection
      rfc={rfc}
      periodos={await getPeriodos(rfc)}
      empleadosActivos={contexto.empleados.length}
    />
  );
}
