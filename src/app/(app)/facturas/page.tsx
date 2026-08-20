import Link from "next/link";
import { buttonClass } from "@/components/ui/styles";
import { FacturasSection } from "@/components/facturas/FacturasSection";
import { getFacturas, type FacturasFiltros } from "@/lib/facturas";
import { getEmisores } from "@/lib/emisores";

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const ES_FECHA = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Los filtros que pegan al backend viven en la URL (`?desde=&hasta=&emisor=…`),
 * no en estado de React: así la pantalla es compartible, el botón Atrás
 * funciona y la consulta ocurre en el servidor.
 *
 * El rango por defecto es el mes en curso porque `getFacturasV2.php` no pagina
 * — ver la nota en `src/lib/facturas.ts`.
 */
function leerFiltros(
  sp: Record<string, string | string[] | undefined>
): FacturasFiltros {
  const uno = (k: string) => {
    const v = sp[k];
    return Array.isArray(v) ? v[0] : v;
  };

  const hoy = new Date();
  const desde = uno("desde");
  const hasta = uno("hasta");

  return {
    emisor: uno("emisor") ?? "",
    tipo: uno("tipo") ?? "TODO",
    estatus: uno("estatus") ?? "TODO",
    desde:
      desde && ES_FECHA.test(desde)
        ? desde
        : ISO(new Date(hoy.getFullYear(), hoy.getMonth(), 1)),
    hasta:
      hasta && ES_FECHA.test(hasta)
        ? hasta
        : ISO(new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)),
  };
}

export default async function FacturasPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const filtros = leerFiltros(await searchParams);

  const [facturas, emisores] = await Promise.all([getFacturas(filtros), getEmisores()]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Facturas</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            Comprobantes timbrados. Haz clic en una fila para ver el CFDI completo.
          </p>
        </div>
        <Link href="/facturas/nueva" className={buttonClass("primary")}>
          Nueva factura
        </Link>
      </div>

      <FacturasSection facturas={facturas} emisores={emisores} filtros={filtros} />
    </div>
  );
}
