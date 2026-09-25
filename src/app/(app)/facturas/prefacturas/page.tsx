import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { PrefacturasSection } from "@/components/facturas/PrefacturasSection";
import { getEmisores } from "@/lib/emisores";
import { getEmisorActivo } from "@/lib/emisorActivo";
import { listarPrefacturas } from "@/lib/prefacturas";

/**
 * Prefacturas en la nube del emisor activo: las guardadas aquí y las que sube
 * Factubox Escritorio (la misma tabla PREFACTURA). Van por emisor porque cada
 * prefactura es de un emisor; con "todos los emisores" se pide elegir uno.
 */
export default async function PrefacturasPage() {
  const emisores = await getEmisores();
  const activo = await getEmisorActivo(emisores);
  const inicial = activo ? await listarPrefacturas(activo.Rfc) : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink">Prefacturas en la nube</h1>
          <p className="mt-1 max-w-[72ch] text-[13px] text-ink-3">
            Las que guardas aquí o en Factubox Escritorio{activo ? ` para ${activo.Nombre}` : ""}. Ábrelas para terminarlas y
            timbrarlas desde cualquiera de los dos.
          </p>
        </div>
        {activo && (
          <Link href="/facturas/nueva?tipo=T" className={buttonClass("primary", "md")}>
            Nueva carta porte
          </Link>
        )}
      </div>

      {!activo ? (
        <Card className="mx-auto max-w-lg">
          <CardBody className="text-center">
            <p className="text-sm font-semibold text-ink">Elige un emisor</p>
            <p className="mt-1 text-[13px] text-ink-3">
              Cada prefactura es de un emisor. Elige uno en la barra de arriba para ver las suyas.
            </p>
          </CardBody>
        </Card>
      ) : !inicial ? (
        <Card className="mx-auto max-w-lg">
          <CardBody className="text-center">
            <p className="text-sm font-semibold text-ink">No se pudieron consultar las prefacturas</p>
            <p className="mt-1 text-[13px] text-ink-3">Vuelve a intentarlo en un momento.</p>
          </CardBody>
        </Card>
      ) : (
        <PrefacturasSection key={activo.Rfc} rfc={activo.Rfc} inicial={inicial} />
      )}
      <p className="px-1 text-[12px] leading-relaxed text-ink-4">
        Al abrir una prefactura del escritorio se cargan tal como se guardaron. Si trae algo que la web todavía no edita, se
        avisa y se abre como copia, para no perderlo en la original.
      </p>
    </div>
  );
}
