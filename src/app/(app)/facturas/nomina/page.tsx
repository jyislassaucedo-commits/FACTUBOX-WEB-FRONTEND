import { NominaSection } from "@/components/nomina/NominaSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPeriodosConNombres } from "@/lib/nomina";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

export default async function NominaPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una corrida de nómina" />;

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
