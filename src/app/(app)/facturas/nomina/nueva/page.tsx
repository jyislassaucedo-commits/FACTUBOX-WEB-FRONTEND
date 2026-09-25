import { NuevaCorridaAsistente } from "@/components/nomina/NuevaCorridaAsistente";
import { loadEmisorContext } from "@/lib/emisorData";
import { getPeriodosConNombres } from "@/lib/nomina";
import { getRegistroPatronal } from "@/lib/empleados";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

/** Los dos primeros pasos de una corrida: quién paga y qué periodo. */
export default async function NuevaCorridaPage() {
  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una corrida de nómina" />;

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const [{ nombres }, registroPatronal] = await Promise.all([getPeriodosConNombres(rfc), getRegistroPatronal(rfc)]);

  return (
    <NuevaCorridaAsistente
      rfc={rfc}
      nombreEmisor={contexto.emisor.Nombre || rfc}
      registroPatronal={registroPatronal}
      empleadosActivos={contexto.empleados.length}
      nombres={nombres}
    />
  );
}
