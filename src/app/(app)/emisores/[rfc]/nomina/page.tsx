import { NominaSection } from "@/components/nomina/NominaSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPeriodosConNombres } from "@/lib/nomina";

export default async function NominaPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const { periodos, nombres } = await getPeriodosConNombres(rfc);

  return (
    <NominaSection
      rfc={rfc}
      periodos={periodos}
      nombres={nombres}
      empleadosActivos={contexto.empleados.length}
    />
  );
}
