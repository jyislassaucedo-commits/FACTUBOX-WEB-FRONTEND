import Link from "next/link";
import {
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Pill,
  Table,
  Td,
  Th,
} from "@/components/ui";
// Desde el servidor los helpers se importan de ui/styles: ui/index es "use
// client" y una funcion suya solo se puede invocar en el navegador.
import { buttonClass } from "@/components/ui/styles";
import { textoEstadoLote, type ResumenLote } from "@/lib/masivoShared";

/* ---------------------------------------------------------------------------
   Los lotes que ya se mandaron.
   ---------------------------------------------------------------------------
   Antes esta tabla, el formulario de subida y el detalle del lote vivían en la
   misma pantalla, con el estado decidiendo qué se veía. El problema no era el
   tamaño: era que un lote no tenía dirección propia. Cerrar la pestaña, o
   mandarle el enlace a un compañero, perdía el avance de vista aunque el lote
   siguiera corriendo en el servidor.

   Ahora cada lote es /facturas/lotes/<id>, y subir la plantilla es un paso del
   asistente de nueva factura, que es donde el usuario ya está cuando quiere
   emitir algo.
--------------------------------------------------------------------------- */

export function LotesLista({ lotes }: { lotes: ResumenLote[] }) {
  return (
    <Card>
      <CardHeader
        title="Lotes"
        description="Plantillas de Excel que mandaste a timbrar."
        action={
          <Link href="/facturas/nueva?tipo=I&modo=plantilla" className={buttonClass("primary", "sm")}>
            Subir una plantilla
          </Link>
        }
      />
      <CardBody>
        {lotes.length === 0 ? (
          <EmptyState
            title="Todavía no has mandado ninguno"
            description="Sube la misma plantilla de Excel que usa la aplicación de escritorio y se revisa antes de timbrar nada."
            action={
              <Link
                href="/facturas/nueva?tipo=I&modo=plantilla"
                className={buttonClass("primary")}
              >
                Subir una plantilla
              </Link>
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Lote</Th>
                <Th>Referencia</Th>
                <Th>Estado</Th>
                <Th className="text-right">Timbrados</Th>
                <Th className="text-right">Sin timbrar</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {lotes.map((l) => {
                const estado = textoEstadoLote(l.Estado);
                const sinTimbrar = l.Total - l.Timbrados;
                return (
                  <tr key={l.IdLote}>
                    <Td className="font-mono text-[13px]">#{l.IdLote}</Td>
                    <Td>{l.Referencia || l.Tipo}</Td>
                    <Td>
                      <Pill
                        tone={
                          estado.tono === "ok"
                            ? "ok"
                            : estado.tono === "danger"
                              ? "danger"
                              : estado.tono === "warn"
                                ? "warn"
                                : "neutral"
                        }
                      >
                        {estado.texto}
                      </Pill>
                    </Td>
                    <Td className="text-right">{l.Timbrados}</Td>
                    <Td className="text-right text-muted">
                      {sinTimbrar > 0 ? sinTimbrar : "—"}
                    </Td>
                    <Td className="text-right">
                      <Link
                        href={`/facturas/lotes/${l.IdLote}`}
                        className="focus-brand rounded text-[13px] font-semibold text-brand hover:underline"
                      >
                        Ver
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
