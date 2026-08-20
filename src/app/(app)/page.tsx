import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import Link from "next/link";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { getDashboardData, type DashboardFilters } from "@/lib/reportes";
import { getEmisores } from "@/lib/emisores";

/**
 * Los filtros del tablero viven en la URL (`/?rfc=&anio=&mes=&tipo=`), no en
 * estado de React: así la vista es compartible, el botón Atrás funciona y los
 * filtros cruzados (clic en un mes o en un tipo de comprobante) son una simple
 * navegación en lugar de estado duplicado.
 */
function leerFiltros(
  sp: Record<string, string | string[] | undefined>
): DashboardFilters {
  const uno = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const anio = parseInt(uno("anio") ?? "", 10);
  const mes = uno("mes") ?? "";

  return {
    rfc: uno("rfc") ?? "",
    anio: Number.isFinite(anio) ? anio : new Date().getFullYear(),
    mes: /^([1-9]|1[0-2])$/.test(mes) ? mes : "",
    tipo: uno("tipo") ?? "TODO",
  };
}

export default async function InicioPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);

  const [data, emisores] = await Promise.all([
    getDashboardData(filtros),
    getEmisores(),
  ]);

  if (!data) {
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">No se pudo cargar el resumen</p>
          <p className="mt-1 text-[13px] text-ink-3">Vuelve a iniciar sesión.</p>
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Inicio</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            Cuánto facturaste, cómo va tu operación y qué conviene revisar.
          </p>
        </div>
        <Link href="/facturas/nueva" className={buttonClass("primary")}>
          Nueva factura
        </Link>
      </div>

      <DashboardView data={data} emisores={emisores} filtros={filtros} />
    </div>
  );
}
