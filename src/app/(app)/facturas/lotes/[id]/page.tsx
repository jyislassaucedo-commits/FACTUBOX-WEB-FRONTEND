import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { LoteDetalle } from "@/components/masivo/LoteDetalle";
import { estatusLote, resultadosLote } from "@/lib/masivo";
import { getEmisores } from "@/lib/emisores";
import { resolverRfcActivo, TODOS } from "@/lib/emisorActivo";
import { EligeEmisor } from "@/components/facturas/EligeEmisor";
import type { ItemResultado } from "@/lib/masivoShared";

/**
 * Un lote tiene ahora dirección propia. Eso es lo que este cambio compra: se
 * puede recargar, guardar en marcadores o mandarle el enlace a quien tenga que
 * revisar los errores de captura, en vez de vivir dentro del estado de una
 * pantalla que hacía de todo.
 *
 * El estado se trae en el servidor para no pintar un lote vacío mientras carga;
 * a partir de ahí lo sigue el cliente, que es quien sabe cuándo dejar de
 * sondear.
 */
export default async function LotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const idLote = Number(id);
  if (!Number.isInteger(idLote) || idLote <= 0) notFound();

  const emisores = await getEmisores();
  const rfc = await resolverRfcActivo(emisores);
  if (rfc === TODOS) return <EligeEmisor que="Un lote de comprobantes" />;

  const lote = await estatusLote(rfc, idLote);
  if ("error" in lote) {
    // Casi siempre es un lote de OTRO emisor: el enlace venía de un marcador y
    // el emisor activo es otro. Decirlo así evita que parezca que se perdió.
    return (
      <Card className="mx-auto max-w-lg">
        <CardBody className="text-center">
          <p className="text-sm font-semibold text-ink">No se pudo abrir el lote #{idLote}</p>
          <p className="mt-1 text-[13px] text-ink-3">{lote.error}</p>
          <p className="mt-1 text-[13px] text-ink-3">
            Si lo mandó otro emisor, cámbialo en la barra de arriba.
          </p>
          <Link href="/facturas/lotes" className={buttonClass("primary", "md", "mt-4")}>
            Ver los lotes de {rfc}
          </Link>
        </CardBody>
      </Card>
    );
  }

  const res = await resultadosLote(rfc, idLote);
  const items: ItemResultado[] = "error" in res ? [] : (res.Items ?? []);

  return <LoteDetalle rfc={rfc} loteInicial={lote} itemsIniciales={items} />;
}
