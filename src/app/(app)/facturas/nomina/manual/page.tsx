import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { NominaManualWizard } from "@/components/nomina/manual/NominaManualWizard";
import { loadEmisorContext } from "@/lib/emisorData";
import { getEmpleados, getRegistroPatronal } from "@/lib/empleados";
import { getPrenomina } from "@/lib/nominaManual";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";
import { PASOS_MANUAL, type PasoManualId } from "@/lib/nominaManualShared";

/**
 * El asistente de nómina manual. Vacío, o cargado desde una prenómina
 * (`?prenomina=ID`, con `&duplicar=1` para abrir una copia sin id y
 * `&paso=revision` para ir directo a timbrar).
 */
export default async function NominaManualPage({
  searchParams,
}: {
  searchParams: Promise<{ prenomina?: string; duplicar?: string; paso?: string }>;
}) {
  const { prenomina: idPrenomina, duplicar, paso } = await searchParams;

  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Un recibo de nómina" />;

  const contexto = await loadEmisorContext(rfc);
  if (!contexto) return null;

  // Con las bajas: el finiquito de alguien que ya se fue es el caso de uso
  // principal de un recibo a mano.
  const [empleados, registroPatronal, resp] = await Promise.all([
    getEmpleados(rfc, true),
    getRegistroPatronal(rfc),
    idPrenomina ? getPrenomina(rfc, idPrenomina) : Promise.resolve(null),
  ]);

  if (resp !== null && resp.Error !== "0") {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">No encontramos esa prenómina</p>
          <p className="mt-1 text-[13px] text-ink-3">{resp.DescripError || "Puede que se haya borrado."}</p>
          <Link href="/facturas/nomina/prenominas" className={buttonClass("secondary", "md", "mt-4")}>
            Volver a prenóminas
          </Link>
        </CardBody>
      </Card>
    );
  }

  const prenomina = resp !== null && resp.Error === "0" ? resp.Prenomina : null;
  const esCopia = duplicar === "1";
  const pasos: PasoManualId[] = PASOS_MANUAL.map((p) => p.id);
  const pasoInicial = pasos.includes(paso as PasoManualId) ? (paso as PasoManualId) : undefined;

  return (
    <NominaManualWizard
      // Con la llave cambia el asistente entero al pasar de una plantilla a
      // otra por la URL, en vez de arrastrar el estado de la anterior.
      key={`${idPrenomina ?? "nueva"}-${esCopia ? "copia" : "orig"}`}
      rfc={rfc}
      nombreEmisor={contexto.emisor.Nombre || rfc}
      emisorToken={contexto.emisor.Token}
      empleados={empleados}
      series={contexto.series.filter((s) => s.Tipo === "N")}
      registroPatronalEmpresa={registroPatronal}
      inicial={
        prenomina
          ? {
              id: esCopia ? undefined : prenomina.Id,
              nombre: esCopia ? "" : prenomina.Nombre,
              form: prenomina.Datos,
              vecesTimbrada: esCopia ? 0 : Number(prenomina.VecesTimbrada) || 0,
              ultimoUuid: esCopia ? null : prenomina.UltimoUuid,
            }
          : undefined
      }
      pasoInicial={pasoInicial}
    />
  );
}
