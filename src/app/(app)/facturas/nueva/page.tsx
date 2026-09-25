import Link from "next/link";
import { Card, CardBody } from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { NuevaFacturaWizard } from "@/components/facturas/NuevaFacturaWizard";
import { getEmisores } from "@/lib/emisores";
import { emisorEstaActivo } from "@/lib/emisoresShared";
import { getTimbres } from "@/lib/timbres";
import { claveLocal, generarIdCCP } from "@/lib/cartaPorte/borrador";

/**
 * Los emisores se cargan en el servidor: son lo primero que necesita el
 * asistente y no dependen de nada que el usuario elija. Series, receptores y
 * folio sí dependen de la selección, así que esos los pide el cliente.
 */
export default async function NuevaFacturaPage({
  searchParams,
}: {
  /**
   * origenRfc/origenUuid: vienen de "Pagar factura" en el detalle.
   * tipo/modo: de los atajos del botón dividido y del menú de Facturas.
   */
  searchParams: Promise<{
    origenRfc?: string;
    origenUuid?: string;
    tipo?: string;
    modo?: string;
  }>;
}) {
  const [{ origenRfc, origenUuid, tipo, modo }, todos, timbres] = await Promise.all([
    searchParams,
    getEmisores(),
    getTimbres(),
  ]);

  // La URL la escribe cualquiera: se acepta solo lo que el asistente entiende
  // y lo demás se ignora, que es como si hubiera entrado sin atajo.
  const tipoInicial = tipo === "I" || tipo === "E" || tipo === "P" || tipo === "T" ? tipo : undefined;
  const modoInicial = modo === "plantilla" ? ("plantilla" as const) : undefined;

  // Aquí —y SOLO aquí— se ocultan los emisores desactivados. El listado de
  // /emisores y los filtros de /facturas los siguen mostrando: desactivar
  // impide EMITIR, no consultar lo ya emitido. Si el filtro viviera dentro de
  // getEmisores(), las facturas de un emisor desactivado se volverían
  // invisibles en el historial, que es justo lo que no debe pasar.
  const emisores = todos.filter((e) => emisorEstaActivo(e.Estatus));

  // Las claves aleatorias del primer borrador salen de aquí: si las generara el
  // asistente, el servidor y el navegador pintarían un IdCCP distinto.
  const claves = { uuidLocal: claveLocal(), idCCP: generarIdCCP() };

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
        <NuevaFacturaWizard
          // Ir de un tipo a otro desde el menú de la barra no cambia de página,
          // solo de ?tipo=: sin la key, el asistente se quedaba en el tipo
          // anterior porque su estado inicial ya se había tomado.
          key={`${tipoInicial ?? ""}|${modoInicial ?? ""}|${origenUuid ?? ""}`}
          emisores={emisores}
          timbres={timbres}
          origenRfc={origenRfc}
          origenUuid={origenUuid}
          tipoInicial={tipoInicial}
          modoInicial={modoInicial}
          claves={claves}
        />
      )}
    </div>
  );
}
