"use client";

import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  Note,
  Pill,
  ProgressBar,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  duracion,
  loteEnCurso,
  textoEstadoItem,
  textoEstadoLote,
  type ItemResultado,
  type ResumenLote,
} from "@/lib/masivoShared";

/* ---------------------------------------------------------------------------
   Cómo se ve un lote: su avance y sus renglones.
   ---------------------------------------------------------------------------
   Presentación pura, sin peticiones: quien las hace es LoteDetalle. Estaban
   dentro de MasivoSection, que hacía subir el archivo, ver el lote y listar el
   historial en la misma pantalla con estado interno. Al partirlo en una lista y
   un detalle con dirección propia, esto es lo único que se comparte.
--------------------------------------------------------------------------- */

export async function guardarRespuesta(res: Response) {
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") ?? "";
  const nombre = /filename="([^"]+)"/.exec(cd)?.[1] ?? "descarga";
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}

export function PanelLote({
  lote,
  items,
  conErrores,
  enRevision,
  ocupado,
  onAccion,
  onDescargar,
}: {
  lote: ResumenLote;
  items: ItemResultado[];
  conErrores: ItemResultado[];
  enRevision: boolean;
  ocupado: boolean;
  onAccion: (a: "CONFIRMAR" | "CANCELAR" | "REINTENTAR") => void;
  onDescargar: (q: "REPORTE" | "PAQUETE", pdf?: boolean) => void;
}) {
  const estado = textoEstadoLote(lote.Estado);
  const falta = duracion(lote.EstimadoSegundos);
  const enCurso = loteEnCurso(lote.Estado);
  const validos = lote.Total - lote.Invalidos;

  return (
    <Card>
      <CardHeader
        title={`Lote #${lote.IdLote}${lote.Referencia ? ` · ${lote.Referencia}` : ""}`}
        action={
          <Link
            href="/facturas/lotes"
            className="focus-brand rounded text-[13px] font-semibold text-brand hover:underline"
          >
            Todos los lotes
          </Link>
        }
      />
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={estado.tono === "ok" ? "ok" : estado.tono === "danger" ? "danger" : estado.tono === "warn" ? "warn" : "neutral"}>
            {estado.texto}
          </Pill>
          <span className="text-[13px] text-muted">
            {lote.Timbrados} de {lote.Total} timbrados
            {lote.Fallados > 0 && ` · ${lote.Fallados} rechazados`}
            {lote.Invalidos > 0 && ` · ${lote.Invalidos} con error de captura`}
          </span>
        </div>

        {enCurso && (
          <div className="space-y-1.5">
            <ProgressBar value={Number(lote.Avance)} />
            <p className="text-[12px] text-muted">
              {lote.Avance}%{falta ? ` · faltan unos ${falta}` : ""}
              {lote.SegundosSinLatido !== null && lote.SegundosSinLatido > 120 && (
                <span className="text-warn">
                  {" "}· sin señales desde hace {duracion(lote.SegundosSinLatido)}, se está reintentando
                </span>
              )}
            </p>
          </div>
        )}

        {lote.Mensaje && lote.Mensaje !== "-" && <Note tone="warn">{lote.Mensaje}</Note>}

        {enRevision && (
          <Note tone={conErrores.length > 0 ? "warn" : "info"} title="Todavía no se ha timbrado nada">
            {conErrores.length > 0 ? (
              <>
                {conErrores.length} de {lote.Total} renglones traen errores de captura y se van a
                omitir. Puedes corregir el archivo y volver a subirlo, o timbrar los {validos} que
                sí están bien.
              </>
            ) : (
              <>Los {lote.Total} comprobantes están listos. Al confirmar se gastan {validos} timbres.</>
            )}
          </Note>
        )}

        <div className="flex flex-wrap gap-2">
          {enRevision && (
            <Button onClick={() => onAccion("CONFIRMAR")} disabled={ocupado || validos === 0}>
              Timbrar {validos} comprobantes
            </Button>
          )}
          {enCurso && (
            <Button variant="secondary" onClick={() => onAccion("CANCELAR")} disabled={ocupado}>
              Detener
            </Button>
          )}
          {!enCurso && lote.Fallados > 0 && (
            <Button variant="secondary" onClick={() => onAccion("REINTENTAR")} disabled={ocupado}>
              Reintentar los {lote.Fallados} rechazados
            </Button>
          )}
          {lote.Total > 0 && (
            <Button variant="ghost" onClick={() => onDescargar("REPORTE")} disabled={ocupado}>
              Reporte en Excel
            </Button>
          )}
          {lote.Timbrados > 0 && (
            <>
              <Button variant="ghost" onClick={() => onDescargar("PAQUETE")} disabled={ocupado}>
                Descargar XML
              </Button>
              <Button variant="ghost" onClick={() => onDescargar("PAQUETE", true)} disabled={ocupado}>
                XML y PDF
              </Button>
            </>
          )}
        </div>

        {items.length > 0 && <TablaItems items={items} />}
      </CardBody>
    </Card>
  );
}

export function TablaItems({ items }: { items: ItemResultado[] }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>#</Th>
          <Th>Comprobante</Th>
          <Th>Receptor</Th>
          <Th align="right">Total</Th>
          <Th>Estado</Th>
          <Th>Detalle</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((it) => {
          const e = textoEstadoItem(it.Estado);
          return (
            <tr key={it.Indice}>
              <Td>{it.Indice}</Td>
              <Td>
                {[it.Serie, it.Folio].filter(Boolean).join("-") || "—"}
                {it.Hoja && (
                  <span className="block text-[11.5px] text-muted">
                    {it.Hoja}, fila {it.Fila}
                  </span>
                )}
              </Td>
              <Td>{it.RfcReceptor ?? "—"}</Td>
              <Td align="right">{it.Total}</Td>
              <Td>
                <Pill tone={e.tono === "ok" ? "ok" : e.tono === "danger" ? "danger" : e.tono === "warn" ? "warn" : "neutral"}>
                  {e.texto}
                </Pill>
              </Td>
              <Td>
                {it.Errores.length > 0 ? (
                  // Con ancho mínimo: en la columna del asistente el mensaje se
                  // partía en una palabra por renglón. La tabla ya se desplaza.
                  <ul className="min-w-[18rem] space-y-0.5 text-[12px]">
                    {it.Errores.map((err, i) => (
                      <li key={i}>
                        {/* La celda es lo que convierte el error en algo accionable:
                            el usuario abre su archivo y va directo ahí. */}
                        {err.Celda && <code className="font-semibold">{err.Celda}</code>}{" "}
                        {err.Columna && <span className="text-muted">{err.Columna}: </span>}
                        {err.Mensaje}
                      </li>
                    ))}
                  </ul>
                ) : it.DescripError !== "-" ? (
                  <span className="block min-w-[18rem] text-[12px]">{it.DescripError}</span>
                ) : it.UUID ? (
                  <code className="text-[11.5px] text-muted">{it.UUID}</code>
                ) : (
                  "—"
                )}
              </Td>
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
}
