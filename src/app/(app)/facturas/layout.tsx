import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { FacturasNav } from "@/components/facturas/FacturasNav";

/**
 * Facturas: todo lo que se emite, bajo un mismo lateral.
 *
 * El emisor no viaja en la dirección — sale de la barra superior. Por eso este
 * layout no lleva [rfc] y las secciones que emiten preguntan por él cuando está
 * en "todos".
 */
export default async function FacturasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const emisores = await getEmisores();
  const rfcActivo = await resolverRfcActivo(emisores);

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside>
        <FacturasNav hayEmisor={rfcActivo !== TODOS} />
      </aside>

      <div className="min-w-0">{children}</div>
    </div>
  );
}
