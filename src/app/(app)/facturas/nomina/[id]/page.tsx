import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { CorridaSection } from "@/components/nomina/CorridaSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getIncidencias, getPeriodo, getPeriodosConNombres } from "@/lib/nomina";
import { getRegistroPatronal } from "@/lib/empleados";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";

export default async function CorridaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Una corrida de nómina" />;

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const [resp, inc, registroPatronal, lista] = await Promise.all([
    getPeriodo(rfc, id),
    getIncidencias(rfc, id),
    getRegistroPatronal(rfc),
    getPeriodosConNombres(rfc),
  ]);
  // La union de PhpResponse solo se estrecha con esta comparacion sola: al
  // juntarla con otra condicion TypeScript deja de saber cual rama es.
  if (resp.Error !== "0") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">No encontramos esta corrida</p>
          <p className="mt-1 text-[13px] text-ink-3">
            {resp.DescripError || "Puede que se haya borrado."}
          </p>
          <Link href="/facturas/nomina" className={buttonClass("secondary", "md", "mt-4")}>
            Volver a nómina
          </Link>
        </CardBody>
      </Card>
    );
  }

  return (
    <CorridaSection
      rfc={rfc}
      emisorToken={contexto.emisor.Token}
      periodo={resp.Periodo}
      recibos={resp.Recibos ?? []}
      conceptos={resp.Conceptos ?? {}}
      incidencias={inc.Error === "0" ? inc.PorEmpleado ?? {} : {}}
      empleados={contexto.empleados}
      registroPatronal={registroPatronal}
      // Un recibo de nomina no puede llevar serie de ingreso: el SAT valida
      // que el tipo de la serie corresponda al del comprobante.
      series={contexto.series.filter((s) => s.Tipo === "N")}
      nombres={lista.nombres}
    />
  );
}
