import Link from "next/link";
import { Card, CardBody, buttonClass } from "@/components/ui";
import { NuevaFacturaWizard } from "@/components/facturas/NuevaFacturaWizard";
import { getEmisores } from "@/lib/emisores";
import { emisorEstaActivo } from "@/lib/emisoresShared";
import { getTimbres } from "@/lib/timbres";

/**
 * Los emisores se cargan en el servidor: son lo primero que necesita el
 * asistente y no dependen de nada que el usuario elija. Series, receptores y
 * folio sí dependen de la selección, así que esos los pide el cliente.
 */
export default async function NuevaFacturaPage() {
  // getTimbres va memoizado con cache(): el layout ya lo pidió en este render.
  const [todos, timbres] = await Promise.all([getEmisores(), getTimbres()]);

  // Aquí —y SOLO aquí— se ocultan los emisores desactivados. El listado de
  // /emisores y los filtros de /facturas los siguen mostrando: desactivar
  // impide EMITIR, no consultar lo ya emitido. Si el filtro viviera dentro de
  // getEmisores(), las facturas de un emisor desactivado se volverían
  // invisibles en el historial, que es justo lo que no debe pasar.
  const emisores = todos.filter((e) => emisorEstaActivo(e.Estatus));

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

      {/* El vacío del asistente dice "Todavía no tienes emisores" y ofrece
          registrar uno. Con emisores dados de alta pero todos desactivados ese
          consejo manda a crear un emisor de más, cuando lo que hace falta es
          reactivar el que ya existe. Se distinguen los dos casos aquí para no
          tocar el asistente. */}
      {todos.length > 0 && emisores.length === 0 ? (
        <Card className="mx-auto max-w-lg">
          <CardBody className="text-center">
            <p className="text-sm font-semibold text-ink">
              Todos tus emisores están desactivados
            </p>
            <p className="mt-1 text-[13px] text-ink-3">
              Reactiva el emisor con el que vas a facturar y vuelve a intentarlo.
            </p>
            <Link href="/emisores" className={buttonClass("primary", "md", "mt-4")}>
              Ver emisores
            </Link>
          </CardBody>
        </Card>
      ) : (
        <NuevaFacturaWizard emisores={emisores} timbres={timbres} />
      )}
    </div>
  );
}
