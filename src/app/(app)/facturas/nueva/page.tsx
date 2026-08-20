import Link from "next/link";
import { NuevaFacturaWizard } from "@/components/facturas/NuevaFacturaWizard";
import { getEmisores } from "@/lib/emisores";
import { getTimbres } from "@/lib/timbres";

/**
 * Los emisores se cargan en el servidor: son lo primero que necesita el
 * asistente y no dependen de nada que el usuario elija. Series, receptores y
 * folio sí dependen de la selección, así que esos los pide el cliente.
 */
export default async function NuevaFacturaPage() {
  // getTimbres va memoizado con cache(): el layout ya lo pidió en este render.
  const [emisores, timbres] = await Promise.all([getEmisores(), getTimbres()]);

  return (
    <div className="space-y-5">
      <div>
        <nav className="mb-2 flex items-center gap-1.5 text-[12.5px] text-ink-3">
          <Link href="/facturas" className="focus-brand rounded hover:text-brand">
            Facturas
          </Link>
          <span aria-hidden>/</span>
          <span className="font-medium text-ink-2">Nueva</span>
        </nav>
        <h1 className="text-xl font-bold tracking-tight text-ink">Nueva factura</h1>
        <p className="mt-1 text-[13px] text-ink-3">
          Te voy pidiendo los datos por pasos y te aviso en el momento si falta algo.
        </p>
      </div>

      <NuevaFacturaWizard emisores={emisores} timbres={timbres} />
    </div>
  );
}
