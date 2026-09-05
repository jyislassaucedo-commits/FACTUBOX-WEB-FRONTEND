import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { EmisorHero, type HeroKpi } from "@/components/emisores/EmisorHero";
import { EmisorNav } from "@/components/emisores/EmisorNav";
import { loadEmisorContext } from "@/lib/emisorData";
import { diasRestantes, formatoFecha, tipoSerie } from "@/lib/emisorNav";
import type { EmisorSectionKey } from "@/lib/emisorNav";

/**
 * Layout compartido por todas las secciones del emisor.
 *
 * Aqui se cargan los datos UNA vez en el servidor y se pasan por props a las
 * secciones: por eso ya no hay "Cargando..." al entrar a cada pantalla. Las
 * secciones mutan via las rutas /api/... y luego llaman router.refresh(), que
 * vuelve a ejecutar este layout y refresca contadores, KPIs y contenido.
 */
export default async function EmisorLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);

  const contexto = await loadEmisorContext(rfc);

  if (!contexto) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">No encontramos este emisor</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Puede que no exista o que no te pertenezca.
          </p>
          <Link href="/emisores" className={buttonClass("secondary", "md", "mt-4")}>
            Volver a emisores
          </Link>
        </CardBody>
      </Card>
    );
  }

  const { emisor, series, receptores, empleados, configs, tieneCsd } = contexto;

  const dias = tieneCsd ? diasRestantes(emisor.VigenciaCert) : null;
  const seriesInvalidas = series.filter((s) => !tipoSerie(s.Tipo).valido).length;

  const alertas: EmisorSectionKey[] = [];
  if (!tieneCsd || (dias !== null && dias < 30)) alertas.push("csd");
  if (seriesInvalidas > 0) alertas.push("series");
  if (receptores.some((r) => !r.Rfc?.trim())) alertas.push("receptores");
  const empleadosIncompletos = empleados.filter(
    (e) => !e.Curp?.trim() || !e.PeriodicidadPago?.trim() || !e.SalarioDiario
  ).length;
  if (empleadosIncompletos > 0) alertas.push("empleados");

  const kpis: HeroKpi[] = [
    {
      label: "Series",
      value: String(series.length),
      meta: seriesInvalidas > 0 ? `${seriesInvalidas} con tipo inválido` : "todas con tipo válido",
      section: "series",
      segment: "series",
      tone: seriesInvalidas > 0 ? "warn" : undefined,
    },
    {
      label: "Receptores",
      value: String(receptores.length),
      meta: "clientes para facturar",
      section: "receptores",
      segment: "receptores",
    },
    {
      label: "Empleados",
      value: String(empleados.length),
      meta:
        empleadosIncompletos > 0
          ? `${empleadosIncompletos} sin datos para timbrar`
          : empleados.length
            ? "listos para su recibo"
            : "sin empleados dados de alta",
      section: "empleados",
      segment: "empleados",
      tone: empleadosIncompletos > 0 ? "warn" : undefined,
    },
    {
      label: "Diseños PDF",
      value: String(configs.length),
      meta: configs.length ? "plantillas guardadas" : "sin plantillas",
      section: "disenos",
      segment: "disenos",
    },
    {
      label: "Vigencia CSD",
      value: tieneCsd ? formatoFecha(emisor.VigenciaCert) : "—",
      meta: !tieneCsd
        ? "sin certificado cargado"
        : dias === null
          ? "fecha no disponible"
          : dias < 0
            ? "vencido"
            : `${dias} días restantes`,
      section: "csd",
      segment: "csd",
      tone: !tieneCsd || (dias !== null && dias < 0)
        ? "danger"
        : dias !== null && dias < 30
          ? "warn"
          : "ok",
    },
  ];

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside>
        <EmisorNav
          rfc={rfc}
          nombre={emisor.Nombre}
          counts={{
            series: series.length,
            receptores: receptores.length,
            empleados: empleados.length,
            disenos: configs.length,
          }}
          alertas={alertas}
        />
      </aside>

      <div className="min-w-0">
        <EmisorHero
          rfc={rfc}
          nombre={emisor.Nombre}
          regimen={emisor.Regimen}
          lugarExp={emisor.LugarExp}
          logoBase64={emisor.Logo || undefined}
          vigenciaCert={emisor.VigenciaCert}
          tieneCsd={tieneCsd}
          kpis={kpis}
        />
        {children}
      </div>
    </div>
  );
}
