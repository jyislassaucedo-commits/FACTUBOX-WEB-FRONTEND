"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Field,
  Input,
  Note,
  Pill,
  ProgressBar,
  Select,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  TIPOS_LOTE,
  duracion,
  intervaloSondeo,
  loteEnCurso,
  textoEstadoItem,
  textoEstadoLote,
  type ItemResultado,
  type ResumenLote,
} from "@/lib/masivoShared";

/**
 * Timbrado masivo: subir una plantilla y ver cómo se timbra.
 *
 * El flujo tiene un paso que parece de más y no lo es: al subir el archivo el
 * lote NO se timbra, queda esperando. Primero se enseñan los errores de captura
 * -- con la celda exacta -- y solo cuando el usuario confirma se gastan
 * timbres. Corregir un Excel antes es gratis; después de timbrar cuesta una
 * cancelación.
 *
 * El lote vive en el servidor, así que cerrar esta pantalla no lo detiene. Al
 * volver aparece en el historial con su avance.
 */
export function MasivoSection({
  rfc,
  lotesIniciales,
}: {
  rfc: string;
  lotesIniciales: ResumenLote[];
}) {
  const [lotes, setLotes] = useState<ResumenLote[]>(lotesIniciales);
  const [lote, setLote] = useState<ResumenLote | null>(null);
  const [items, setItems] = useState<ItemResultado[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [serie, setSerie] = useState("");
  const [referencia, setReferencia] = useState("");
  const [modo, setModo] = useState<"PRUEBAS" | "PRODUCCION">("PRUEBAS");
  const [enviarCorreo, setEnviarCorreo] = useState(false);
  const [tipoPlantilla, setTipoPlantilla] = useState("PREFACTURA");

  const desdeCuando = useRef<number>(0);

  const cargarResultados = useCallback(
    async (idLote: number) => {
      const r = await fetch("/api/masivo/resultados", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc, idLote, filtro: "TODOS", desde: 0 }),
      }).then((x) => x.json());
      if (!r.error) setItems(r.Items ?? []);
    },
    [rfc]
  );

  // Sondeo del avance. Se espacia conforme el lote se alarga y se detiene en
  // cuanto deja de poder cambiar solo.
  useEffect(() => {
    if (!lote || !loteEnCurso(lote.Estado)) return;
    if (desdeCuando.current === 0) desdeCuando.current = Date.now();

    const corriendo = (Date.now() - desdeCuando.current) / 1000;
    const t = setTimeout(async () => {
      const r = await fetch("/api/masivo/estatus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rfc, idLote: lote.IdLote }),
      }).then((x) => x.json());

      if (r.error) {
        setError(r.error);
        return;
      }
      setLote(r.lote);
      // Los renglones se refrescan con el avance para que se vean salir, no
      // todos de golpe al final.
      void cargarResultados(lote.IdLote);
      if (!loteEnCurso(r.lote.Estado)) {
        desdeCuando.current = 0;
        setLotes((prev) => [r.lote, ...prev.filter((l) => l.IdLote !== r.lote.IdLote)]);
      }
    }, intervaloSondeo(corriendo));

    return () => clearTimeout(t);
  }, [lote, rfc, cargarResultados]);

  async function subir() {
    if (!archivo) {
      setError("Elige el archivo de la plantilla");
      return;
    }
    setOcupado(true);
    setError(null);

    const fd = new FormData();
    fd.append("rfc", rfc);
    fd.append("archivo", archivo);
    fd.append("modo", modo);
    if (serie) fd.append("serie", serie);
    if (referencia) fd.append("referencia", referencia);
    if (enviarCorreo) fd.append("enviarCorreo", "1");

    const r = await fetch("/api/masivo/crear", { method: "POST", body: fd })
      .then((x) => x.json())
      .catch(() => ({ error: "No se pudo subir el archivo" }));

    setOcupado(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    setLote(r.lote);
    void cargarResultados(r.lote.IdLote);
  }

  async function accion(accion: "CONFIRMAR" | "CANCELAR" | "REINTENTAR") {
    if (!lote) return;
    setOcupado(true);
    setError(null);
    const r = await fetch("/api/masivo/accion", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc, idLote: lote.IdLote, accion }),
    }).then((x) => x.json());
    setOcupado(false);
    if (r.error) {
      setError(r.error);
      return;
    }
    desdeCuando.current = Date.now();
    setLote(r.lote);
  }

  async function descargar(que: "REPORTE" | "PAQUETE", incluirPdf = false) {
    if (!lote) return;
    setOcupado(true);
    const res = await fetch("/api/masivo/descarga", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rfc, idLote: lote.IdLote, que, incluirPdf }),
    });
    setOcupado(false);

    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error ?? "No se pudo descargar");
      return;
    }
    await guardarRespuesta(res);
  }

  async function bajarPlantilla() {
    setOcupado(true);
    const res = await fetch("/api/masivo/plantilla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rfc,
        tipo: tipoPlantilla,
        // Solo pagos es exclusivamente vertical; para los otros dos la
        // vertical es la que admite muchos renglones por comprobante.
        layout: "VERTICAL",
      }),
    });
    setOcupado(false);
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      setError(j?.error ?? "No se pudo descargar la plantilla");
      return;
    }
    await guardarRespuesta(res);
  }

  const enRevision = lote?.Estado === "REVISION";
  const conErrores = items.filter((i) => i.Errores.length > 0);

  return (
    <div className="space-y-4">
      {error && <Note tone="danger" title="No se pudo">{error}</Note>}

      {!lote && (
        <Card>
          <CardHeader title="Timbrar una plantilla" />
          <CardBody className="space-y-4">
            <Note tone="info">
              Sube la misma plantilla de Excel que usa la aplicación de escritorio. Se
              revisa primero y no se timbra nada hasta que lo confirmes.
            </Note>

            <div className="flex flex-wrap items-end gap-3">
              <Field label="Plantilla vacía">
                <Select value={tipoPlantilla} onChange={(e) => setTipoPlantilla(e.target.value)}>
                  {TIPOS_LOTE.map((t) => (
                    <option key={t.valor} value={t.valor}>
                      {t.etiqueta}
                    </option>
                  ))}
                </Select>
              </Field>
              <Button variant="secondary" onClick={bajarPlantilla} disabled={ocupado}>
                Descargar plantilla
              </Button>
            </div>

            <hr className="border-line-2" />

            <Field label="Archivo lleno (.xlsx)">
              <input
                type="file"
                accept=".xlsx"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="text-[13px]"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Serie" hint="Se usa donde el archivo no traiga una">
                <Input value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="A" />
              </Field>
              <Field label="Referencia" hint="Para reconocer el lote después">
                <Input
                  value={referencia}
                  onChange={(e) => setReferencia(e.target.value)}
                  placeholder="Facturación de septiembre"
                />
              </Field>
              <Field label="Modo">
                <Select
                  value={modo}
                  onChange={(e) => setModo(e.target.value === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS")}
                >
                  <option value="PRUEBAS">Pruebas (no consume timbres reales)</option>
                  <option value="PRODUCCION">Producción</option>
                </Select>
              </Field>
            </div>

            <label className="flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                checked={enviarCorreo}
                onChange={(e) => setEnviarCorreo(e.target.checked)}
              />
              Avisar por correo a los receptores que traigan dirección en el archivo
            </label>

            <Button onClick={subir} disabled={ocupado || !archivo}>
              {ocupado ? "Revisando…" : "Revisar el archivo"}
            </Button>
          </CardBody>
        </Card>
      )}

      {lote && <PanelLote
        lote={lote}
        items={items}
        conErrores={conErrores}
        enRevision={enRevision}
        ocupado={ocupado}
        onAccion={accion}
        onDescargar={descargar}
        onSalir={() => {
          setLote(null);
          setItems([]);
          setArchivo(null);
          desdeCuando.current = 0;
        }}
      />}

      {!lote && lotes.length > 0 && (
        <Card>
          <CardHeader title="Lotes anteriores" />
          <CardBody>
            <Table>
              <thead>
                <tr>
                  <Th>Lote</Th>
                  <Th>Referencia</Th>
                  <Th>Estado</Th>
                  <Th align="right">Timbrados</Th>
                  <Th align="right">Sin timbrar</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {lotes.map((l) => {
                  const e = textoEstadoLote(l.Estado);
                  const sinTimbrar = l.Total - l.Timbrados;
                  return (
                    <tr key={l.IdLote}>
                      <Td>#{l.IdLote}</Td>
                      <Td>{l.Referencia ?? l.Tipo}</Td>
                      <Td>
                        <Pill tone={e.tono === "ok" ? "ok" : e.tono === "danger" ? "danger" : e.tono === "warn" ? "warn" : "neutral"}>
                          {e.texto}
                        </Pill>
                      </Td>
                      <Td align="right">{l.Timbrados}</Td>
                      <Td align="right">{sinTimbrar > 0 ? sinTimbrar : "—"}</Td>
                      <Td align="right">
                        <Button size="sm" variant="ghost" onClick={() => { setLote(l); void 0; }}>
                          Ver
                        </Button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </CardBody>
        </Card>
      )}

      {!lote && lotes.length === 0 && (
        <EmptyState
          title="Todavía no has timbrado ningún lote"
          description="Descarga la plantilla, llénala y súbela aquí."
        />
      )}
    </div>
  );
}

/** Descarga lo que venga en la respuesta con el nombre que trae. */
async function guardarRespuesta(res: Response) {
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

function PanelLote({
  lote,
  items,
  conErrores,
  enRevision,
  ocupado,
  onAccion,
  onDescargar,
  onSalir,
}: {
  lote: ResumenLote;
  items: ItemResultado[];
  conErrores: ItemResultado[];
  enRevision: boolean;
  ocupado: boolean;
  onAccion: (a: "CONFIRMAR" | "CANCELAR" | "REINTENTAR") => void;
  onDescargar: (q: "REPORTE" | "PAQUETE", pdf?: boolean) => void;
  onSalir: () => void;
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
          <Button size="sm" variant="ghost" onClick={onSalir}>
            Volver
          </Button>
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

function TablaItems({ items }: { items: ItemResultado[] }) {
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
                  <ul className="space-y-0.5 text-[12px]">
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
                  <span className="text-[12px]">{it.DescripError}</span>
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
