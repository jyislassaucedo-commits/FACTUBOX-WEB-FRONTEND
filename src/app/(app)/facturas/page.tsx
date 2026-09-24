import { FacturasSection } from "@/components/facturas/FacturasSection";
import { getFacturas, type FacturasFiltros } from "@/lib/facturas";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { NuevaSplitButton } from "@/components/facturas/NuevaSplitButton";

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
    // El emisor ya no es un filtro de esta pantalla: sale de la barra superior
    // y vale para toda la aplicación. Se sigue leyendo de la URL para no
    // romper un enlace guardado con ?emisor=, pero quien manda es el activo
    // (ver abajo).
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
  const emisores = await getEmisores();
  const rfcActivo = await resolverRfcActivo(emisores);

  // El emisor activo gana sobre el ?emisor= de la URL: si están los dos, el de
  // la barra es el que el usuario está viendo y sería raro que la lista dijera
  // otra cosa. Con "todos" activo (rfcActivo = "") se respeta lo que traiga la
  // URL, que es como se llega desde el tablero al pinchar un emisor concreto.
  const leidos = leerFiltros(await searchParams);
  const filtros = rfcActivo ? { ...leidos, emisor: rfcActivo } : leidos;

  const facturas = await getFacturas(filtros);
  const nombreActivo = emisores.find((e) => e.Rfc === rfcActivo)?.Nombre;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Facturas</h1>
          <p className="mt-1 text-[13px] text-ink-3">
            {nombreActivo
              ? `Lo que ha emitido ${nombreActivo}, de cualquier tipo. Haz clic en una fila para ver el CFDI completo.`
              : "Comprobantes de todos tus emisores. Haz clic en una fila para ver el CFDI completo."}
          </p>
        </div>
        <NuevaSplitButton hayEmisor={rfcActivo !== TODOS} alinear="derecha" />
      </div>

      <FacturasSection facturas={facturas} filtros={filtros} />
    </div>
  );
}
