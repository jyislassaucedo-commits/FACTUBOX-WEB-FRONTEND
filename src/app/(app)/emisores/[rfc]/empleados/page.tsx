import { EmpleadosSection } from "@/components/empleados/EmpleadosSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getEmpleados, getRegistroPatronal } from "@/lib/empleados";

export default async function EmpleadosPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  // El contexto compartido solo trae a los activos, que es lo que necesita el
  // menu para su contador. Las bajas y el registro patronal se piden aqui: no
  // los usa ninguna otra seccion del emisor y no tiene caso cargarlos en todas.
  const [todos, registroPatronal] = await Promise.all([
    getEmpleados(rfc, true),
    getRegistroPatronal(rfc),
  ]);

  const bajas = todos.filter((e) => e.FechaBaja !== null);

  return (
    <EmpleadosSection
      rfc={rfc}
      empleados={contexto.empleados}
      bajas={bajas}
      registroPatronal={registroPatronal}
    />
  );
}
