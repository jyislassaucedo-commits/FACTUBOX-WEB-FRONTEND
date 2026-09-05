import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { CorridaSection } from "@/components/nomina/CorridaSection";
import { loadEmisorContext } from "@/lib/emisorData";
import { getIncidencias, getPeriodo } from "@/lib/nomina";

export default async function CorridaPage({
  params,
}: {
  params: Promise<{ rfc: string; id: string }>;
}) {
  const { rfc: rfcParam, id } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  const [resp, inc] = await Promise.all([getPeriodo(rfc, id), getIncidencias(rfc, id)]);
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
          <Link href={`/emisores/${encodeURIComponent(rfc)}/nomina`} className={buttonClass("secondary", "md", "mt-4")}>
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
      incidencias={inc.Error === "0" ? inc.PorEmpleado ?? {} : {}}
      // Un recibo de nomina no puede llevar serie de ingreso: el SAT valida
      // que el tipo de la serie corresponda al del comprobante.
      series={contexto.series.filter((s) => s.Tipo === "N")}
    />
  );
}
