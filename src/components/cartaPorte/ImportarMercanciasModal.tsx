"use client";

import { useMemo, useRef, useState } from "react";
import { Button, FileDrop, Modal, Note, ProgressBar } from "@/components/ui";
import type { MercanciaViaje } from "@/lib/cartaPorte/borrador";
import {
  ImportacionCancelada,
  erroresCsv,
  guardarEnCatalogo,
  leerArchivoExcel,
  leerPlantillaMercancias,
  revisarContraSat,
  type Avance,
  type CacheSat,
  type Control,
} from "@/lib/cartaPorte/importarMercancias";
import { MAX_MERCANCIAS_COMPROBANTE } from "@/lib/cartaPorte/validar";
import {
  HOJAS_PLANTILLA,
  ordenarErrores,
  resolverRepartos,
  type ErrorImportacion,
  type MercanciaImportada,
} from "@/lib/cartaPorte/plantillaMercancias";

/*
   Importar mercancías desde la plantilla de Excel del escritorio (mockup
   aprobado: elegir archivo → procesando → revisión con errores → importadas).

   - modo "cartaPorte": desde el paso Mercancías del asistente; se agregan al
     viaje con su reparto (hoja Cantidad Transportista) y, si se pide, también
     se guardan en el catálogo.
   - modo "catalogo": desde el catálogo de mercancías del emisor; solo se
     guardan ahí (el reparto es de un viaje, así que esa hoja se ignora).
*/

type Props = {
  rfc: string;
  onCerrar: () => void;
} & (
  | {
      modo: "cartaPorte";
      /** idsUbicacion() del viaje: clave de la parada → "OR000001"/"DE000002". */
      idsParadas: Map<string, string>;
      /** Las que ya tiene el viaje, para avisar si se pasa del tope por comprobante. */
      yaHay: number;
      onImportadas: (mercancias: MercanciaViaje[], guardadasEnCatalogo: number | null) => void;
    }
  | { modo: "catalogo"; onGuardadas: (total: number, nuevas: number) => void }
);

type Etapa =
  | { tipo: "archivo"; error?: string }
  | { tipo: "leyendo"; archivo: File }
  | { tipo: "revisando"; archivo: File; filasPorHoja: Record<string, number>; avance: Avance | null; restante: number | null; pausado: boolean }
  | { tipo: "fallo"; archivo: File; mensaje: string }
  | { tipo: "revision"; archivo: File; validas: MercanciaImportada[]; errores: ErrorImportacion[]; peso: number }
  | { tipo: "guardando"; hechas: number; total: number };

const ERRORES_POR_PAGINA = 100;
const fmt = (n: number, dec = 0) => n.toLocaleString("es-MX", { maximumFractionDigits: dec });

export function ImportarMercanciasModal(props: Props) {
  const { rfc, onCerrar, modo } = props;
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "archivo" });
  const [alCatalogo, setAlCatalogo] = useState(modo === "catalogo");
  const [errorGuardar, setErrorGuardar] = useState<string | null>(null);
  const cache = useRef<CacheSat>(new Map());
  const control = useRef<Control>({ pausado: false, cancelado: false });
  /** Lo que ya pasó el formato (y el reparto): se conserva para reintentar la revisión. */
  const previo = useRef<{ items: MercanciaImportada[]; errores: ErrorImportacion[]; filasPorHoja: Record<string, number> } | null>(null);
  const inicio = useRef(0);

  const ocupado = etapa.tipo === "leyendo" || etapa.tipo === "revisando" || etapa.tipo === "guardando";

  async function revisar(archivo: File) {
    const p = previo.current!;
    control.current = { pausado: false, cancelado: false };
    inicio.current = Date.now();
    setEtapa({ tipo: "revisando", archivo, filasPorHoja: p.filasPorHoja, avance: null, restante: null, pausado: false });
    try {
      const { validas, errores } = await revisarContraSat(p.items, {
        cache: cache.current,
        control: control.current,
        onAvance: (avance) => {
          const falta = avance.total - avance.hechas;
          const restante = falta > 0 ? Math.ceil(((Date.now() - inicio.current) / avance.hechas) * falta / 1000) : null;
          setEtapa((e) => (e.tipo === "revisando" ? { ...e, avance, restante } : e));
        },
      });
      setEtapa({
        tipo: "revision",
        archivo,
        validas,
        errores: ordenarErrores([...p.errores, ...errores]),
        peso: validas.reduce((a, v) => a + (Number(v.mercancia.pesoTotal) || 0), 0),
      });
    } catch (e) {
      if (e instanceof ImportacionCancelada) {
        setEtapa({ tipo: "archivo" });
        return;
      }
      setEtapa({ tipo: "fallo", archivo, mensaje: e instanceof Error ? e.message : "No se pudo revisar el archivo" });
    }
  }

  async function elegir(archivo: File | null) {
    if (!archivo) return;
    if (!/\.xlsx$/i.test(archivo.name)) {
      setEtapa({ tipo: "archivo", error: "Sube el archivo en formato .xlsx (la plantilla de mercancías)." });
      return;
    }
    setEtapa({ tipo: "leyendo", archivo });
    let lectura;
    try {
      lectura = leerPlantillaMercancias(await leerArchivoExcel(archivo));
    } catch {
      setEtapa({ tipo: "archivo", error: "No se pudo leer el archivo. Revisa que sea la plantilla de mercancías guardada como .xlsx." });
      return;
    }
    if (lectura.mercancias.length === 0 && lectura.errores.length === 0) {
      setEtapa({ tipo: "archivo", error: "La hoja Mercancia no trae filas desde la fila 3." });
      return;
    }
    let items = lectura.mercancias;
    let errores = lectura.errores;
    if (props.modo === "cartaPorte") {
      const r = resolverRepartos(items, props.idsParadas);
      items = r.validas;
      errores = [...errores, ...r.errores];
    } else {
      items = items.map((i) => ({ ...i, repartos: [] }));
    }
    previo.current = { items, errores, filasPorHoja: lectura.filasPorHoja };
    await revisar(archivo);
  }

  async function importar() {
    if (etapa.tipo !== "revision") return;
    const mercancias = etapa.validas.map((v) => v.mercancia);
    let nuevas: number | null = null;
    if (alCatalogo) {
      setEtapa({ tipo: "guardando", hechas: 0, total: mercancias.length });
      const volver = etapa;
      try {
        nuevas = await guardarEnCatalogo(rfc, mercancias, (hechas) =>
          setEtapa((e) => (e.tipo === "guardando" ? { ...e, hechas } : e))
        );
      } catch (e) {
        setEtapa(volver);
        setErrorGuardar(e instanceof Error ? e.message : "No se pudieron guardar en el catálogo");
        return;
      }
    }
    if (props.modo === "cartaPorte") props.onImportadas(mercancias, nuevas);
    else props.onGuardadas(mercancias.length, nuevas ?? 0);
  }
  function cerrar() {
    if (ocupado) return; // se cancela con su botón, no por accidente
    onCerrar();
  }

  return (
    <Modal title="Importar mercancías desde Excel" onClose={cerrar} xl>
      {etapa.tipo === "archivo" && (
        <PasoArchivo
          modo={modo}
          error={etapa.error}
          alCatalogo={alCatalogo}
          setAlCatalogo={setAlCatalogo}
          onArchivo={elegir}
        />
      )}

      {(etapa.tipo === "leyendo" || etapa.tipo === "revisando") && (
        <PasoProcesando
          archivo={etapa.archivo}
          filasPorHoja={etapa.tipo === "revisando" ? etapa.filasPorHoja : null}
          avance={etapa.tipo === "revisando" ? etapa.avance : null}
          pausado={etapa.tipo === "revisando" && etapa.pausado}
          restante={etapa.tipo === "revisando" ? etapa.restante : null}
          onPausar={() => {
            control.current.pausado = !control.current.pausado;
            setEtapa((e) => (e.tipo === "revisando" ? { ...e, pausado: control.current.pausado } : e));
          }}
          onCancelar={() => {
            control.current.cancelado = true;
          }}
        />
      )}

      {etapa.tipo === "fallo" && (
        <div className="space-y-4">
          <Note tone="danger" title="La revisión se detuvo">
            {etapa.mensaje}. Lo que ya se revisó se conserva: al reintentar sigue desde ahí.
          </Note>
          <div className="flex gap-2">
            <Button variant="primary" onClick={() => revisar(etapa.archivo)}>
              Reintentar
            </Button>
            <Button variant="ghost" onClick={() => setEtapa({ tipo: "archivo" })}>
              Elegir otro archivo
            </Button>
          </div>
        </div>
      )}

      {etapa.tipo === "revision" && (
        <PasoRevision
          modo={modo}
          archivo={etapa.archivo}
          validas={etapa.validas.length}
          idsValidos={new Set(etapa.validas.map((v) => v.identificador))}
          errores={etapa.errores}
          peso={etapa.peso}
          alCatalogo={alCatalogo}
          errorGuardar={errorGuardar}
          excede={
            props.modo === "cartaPorte" && props.yaHay + etapa.validas.length > MAX_MERCANCIAS_COMPROBANTE
              ? props.yaHay + etapa.validas.length
              : null
          }
          onImportar={importar}
          onOtroArchivo={() => {
            setErrorGuardar(null);
            setEtapa({ tipo: "archivo" });
          }}
        />
      )}

      {etapa.tipo === "guardando" && (
        <div className="space-y-3 py-6">
          <div className="flex justify-between text-[13.5px]">
            <span>Guardando en el catálogo de mercancías</span>
            <span className="font-mono">
              {fmt(etapa.hechas)} de {fmt(etapa.total)}
            </span>
          </div>
          <ProgressBar value={(etapa.hechas / Math.max(1, etapa.total)) * 100} />
        </div>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function Casilla({
  checked,
  onChange,
  titulo,
  detalle,
  disabled,
}: {
  checked: boolean;
  onChange?: (v: boolean) => void;
  titulo: string;
  detalle: string;
  disabled?: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5 text-[13.5px] text-ink">
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 accent-[var(--brand)]"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span>
        {titulo}
        <span className="mt-0.5 block text-[12.5px] text-ink-3">{detalle}</span>
      </span>
    </label>
  );
}

function PasoArchivo({
  modo,
  error,
  alCatalogo,
  setAlCatalogo,
  onArchivo,
}: {
  modo: "cartaPorte" | "catalogo";
  error?: string;
  alCatalogo: boolean;
  setAlCatalogo: (v: boolean) => void;
  onArchivo: (f: File | null) => void;
}) {
  return (
    <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_300px]">
      <div className="space-y-3">
        {error && <Note tone="danger">{error}</Note>}
        <FileDrop
          label="Suelta aquí tu archivo de mercancías o haz clic para elegirlo"
          hint="La plantilla del escritorio (.xlsx) con sus seis hojas. Aguanta miles de filas."
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          file={null}
          onFile={onArchivo}
        />
        <p className="text-[12.5px] leading-relaxed text-ink-3">
          Hojas que se leen: {HOJAS_PLANTILLA.join(", ")}. Los encabezados van en la fila 2 y los datos desde la fila 3; las
          hojas se unen por el identificador de la mercancía.{" "}
          <a
            href="/plantillas/PLANTILLA-MERCANCIAS.xlsx"
            download
            className="focus-brand rounded font-medium text-brand underline-offset-2 hover:underline"
          >
            Descargar la plantilla
          </a>
        </p>
      </div>
      <div className="space-y-3.5 rounded-xl border border-line bg-surface-2 p-4">
        <p className="text-[13.5px] font-semibold text-ink">Al importar</p>
        {modo === "cartaPorte" ? (
          <>
            <Casilla
              checked
              disabled
              titulo="Agregarlas a esta carta porte"
              detalle="Con su reparto por origen y destino de la hoja Cantidad Transportista."
            />
            <Casilla
              checked={alCatalogo}
              onChange={setAlCatalogo}
              titulo="Guardarlas también en el catálogo de mercancías"
              detalle="Las que ya existan con la misma clave, descripción y unidad no se duplican."
            />
          </>
        ) : (
          <p className="text-[12.5px] leading-relaxed text-ink-2">
            Se guardan en tu catálogo de mercancías. Las que ya existan con la misma clave, descripción y unidad se actualizan en
            vez de duplicarse. La hoja Cantidad Transportista se ignora: el reparto se captura en cada carta porte.
          </p>
        )}
        <div className="h-px bg-line-2" />
        <p className="text-[12px] leading-relaxed text-ink-3">
          El archivo se lee en tu navegador y las claves se revisan en el servidor en tandas de 500 filas. Si algo falla a
          medias, lo ya revisado se conserva y puedes reintentar desde donde se quedó.
        </p>
      </div>
    </div>
  );
}

function PasoProcesando({
  archivo,
  filasPorHoja,
  avance,
  pausado,
  restante,
  onPausar,
  onCancelar,
}: {
  archivo: File;
  filasPorHoja: Record<string, number> | null;
  avance: Avance | null;
  pausado: boolean;
  restante: number | null;
  onPausar: () => void;
  onCancelar: () => void;
}) {
  const pct = avance ? (avance.hechas / Math.max(1, avance.total)) * 100 : 0;
  const hojas = filasPorHoja
    ? Object.entries(filasPorHoja)
        .filter(([, n]) => n > 0)
        .map(([h, n]) => `${fmt(n)} en ${h}`)
        .join(" · ")
    : "";

  return (
    <div className="space-y-5 py-1">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[15px] font-semibold text-ink">{archivo.name}</span>
        <span className="font-mono text-[12px] text-ink-3">
          {(archivo.size / 1_000_000).toFixed(1)} MB{hojas && ` · ${hojas}`}
        </span>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between gap-3 text-[13.5px] text-ink">
          <span>
            {!filasPorHoja
              ? "Leyendo el archivo…"
              : pausado
                ? "En pausa"
                : `Revisando contra los catálogos del SAT${avance ? ` · tanda ${avance.tanda} de ${avance.tandas}` : "…"}`}
          </span>
          {avance && (
            <span className="font-mono">
              {fmt(avance.hechas)} de {fmt(avance.total)}
            </span>
          )}
        </div>
        <ProgressBar value={pct} />
      </div>
      {avance && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Dato titulo="Listas" valor={fmt(avance.listas)} tono="text-ok" />
          <Dato titulo="Con errores" valor={fmt(avance.conError)} tono="text-danger" />
          <Dato titulo="Peso acumulado" valor={`${fmt(avance.peso, 1)} kg`} />
          <Dato titulo="Tiempo restante" valor={restante === null ? "—" : `~${restante} s`} />
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" onClick={onPausar} disabled={!filasPorHoja}>
          {pausado ? "Seguir" : "Pausar"}
        </Button>
        <Button variant="ghost" onClick={onCancelar} disabled={!filasPorHoja}>
          Cancelar la importación
        </Button>
      </div>
    </div>
  );
}

function Dato({ titulo, valor, tono }: { titulo: string; valor: string; tono?: string }) {
  return (
    <div>
      <p className="text-[12px] text-ink-3">{titulo}</p>
      <p className={`font-mono text-[20px] font-semibold ${tono ?? "text-ink"}`}>{valor}</p>
    </div>
  );
}

function PasoRevision({
  modo,
  archivo,
  validas,
  idsValidos,
  errores,
  peso,
  alCatalogo,
  errorGuardar,
  excede,
  onImportar,
  onOtroArchivo,
}: {
  modo: "cartaPorte" | "catalogo";
  archivo: File;
  validas: number;
  idsValidos: Set<string>;
  errores: ErrorImportacion[];
  peso: number;
  alCatalogo: boolean;
  errorGuardar: string | null;
  /** Total que quedaría en el viaje si pasa del tope por comprobante. */
  excede: number | null;
  onImportar: () => void;
  onOtroArchivo: () => void;
}) {
  const [hoja, setHoja] = useState<string | null>(null);
  const [pagina, setPagina] = useState(1);
  const porHoja = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of errores) m.set(e.hoja, (m.get(e.hoja) ?? 0) + 1);
    return [...m.entries()];
  }, [errores]);
  const filtrados = hoja ? errores.filter((e) => e.hoja === hoja) : errores;
  const paginas = Math.max(1, Math.ceil(filtrados.length / ERRORES_POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const visibles = filtrados.slice((pag - 1) * ERRORES_POR_PAGINA, pag * ERRORES_POR_PAGINA);
  // Mercancías que se quedan fuera (un identificador repetido no tumba la fila original).
  const conError = new Set(errores.map((e) => e.identificador || `#${e.hoja}${e.fila}`).filter((i) => !idsValidos.has(i))).size;
  const verbo = modo === "cartaPorte" ? "Importar" : "Guardar";
  const imperativo = modo === "cartaPorte" ? "importa" : "guarda";

  function descargar() {
    const url = URL.createObjectURL(erroresCsv(errores));
    const a = document.createElement("a");
    a.href = url;
    a.download = `errores-${archivo.name.replace(/\.xlsx$/i, "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="grid gap-5 md:grid-cols-[280px_minmax(0,1fr)]">
      <div className="flex flex-col gap-3.5 rounded-xl border border-line p-4">
        <p className="text-[15px] font-semibold text-ink">Revisión terminada</p>
        <div className="space-y-2 text-[13.5px]">
          <Fila etiqueta={`Listas para ${verbo.toLowerCase()}`} valor={fmt(validas)} tono="text-ok" />
          <Fila etiqueta="Con errores" valor={fmt(conError)} tono={conError ? "text-danger" : "text-ink"} />
          <Fila etiqueta="Peso total de las listas" valor={`${fmt(peso, 3)} kg`} />
        </div>
        <div className="h-px bg-line-2" />
        {errorGuardar && <Note tone="danger">{errorGuardar}</Note>}
        {excede !== null && (
          <Note tone="warn">
            La carta porte quedaría con {fmt(excede)} mercancías y un comprobante aguanta hasta{" "}
            {fmt(MAX_MERCANCIAS_COMPROBANTE)}. Puedes importarlas, pero para timbrar tendrás que dividir el viaje.
          </Note>
        )}
        <p className="text-[12.8px] leading-relaxed text-ink-2">
          {validas === 0
            ? "Ninguna fila pasó la revisión. Corrige el archivo y vuelve a subirlo."
            : errores.length
              ? `Corrige el archivo y vuelve a subirlo, o ${imperativo} las ${fmt(validas)} listas ahora y agrega las demás después.`
              : `Todo el archivo pasó la revisión.${modo === "cartaPorte" && alCatalogo ? " También se guardarán en tu catálogo." : ""}`}
        </p>
        <div className="mt-auto flex flex-col gap-2">
          {validas > 0 && (
            <Button variant="primary" onClick={onImportar} className="justify-center">
              {verbo} {validas === 1 ? "la lista" : `las ${fmt(validas)} listas`}
            </Button>
          )}
          {errores.length > 0 && (
            <Button variant="secondary" onClick={descargar} className="justify-center">
              Descargar los errores
            </Button>
          )}
          <Button variant="ghost" onClick={onOtroArchivo} className="justify-center">
            Subir el archivo corregido
          </Button>
        </div>
      </div>

      <div className="flex min-h-[320px] flex-col overflow-hidden rounded-xl border border-line">
        {errores.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <p className="text-[14px] font-semibold text-ok">Sin errores</p>
              <p className="mt-1 text-[12.8px] text-ink-3">
                {fmt(validas)} mercancía{validas === 1 ? "" : "s"} con sus claves revisadas contra los catálogos del SAT.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 border-b border-line-2 px-3.5 py-2.5">
              <span className="text-[13.5px] font-semibold text-ink">
                {fmt(errores.length)} error{errores.length === 1 ? "" : "es"}
              </span>
              {porHoja.length > 1 &&
                [["Todas", null, errores.length] as const, ...porHoja.map(([h, n]) => [h, h, n] as const)].map(([nombre, valor, n]) => (
                  <button
                    key={nombre}
                    type="button"
                    onClick={() => {
                      setHoja(valor);
                      setPagina(1);
                    }}
                    className={`focus-brand h-6 rounded-full px-2.5 text-[12px] font-medium transition ${
                      hoja === valor ? "bg-ink text-surface" : "bg-line-2 text-ink-2 hover:text-ink"
                    }`}
                  >
                    {nombre} {fmt(n)}
                  </button>
                ))}
            </div>
            <div className="max-h-[52vh] flex-1 overflow-auto">
              <table className="w-full text-[12.8px]">
                <thead className="sticky top-0 bg-surface">
                  <tr className="border-b border-line text-left text-[12px] text-ink-3">
                    <th className="px-3 py-2 font-medium">Hoja</th>
                    <th className="px-3 py-2 text-right font-medium">Fila</th>
                    <th className="px-3 py-2 font-medium">Identificador</th>
                    <th className="px-3 py-2 font-medium">Columna</th>
                    <th className="px-3 py-2 font-medium">Qué pasa</th>
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((e, i) => (
                    <tr key={`${e.hoja}-${e.fila}-${e.columna}-${i}`} className="border-b border-line-2 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-ink-2">{e.hoja}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(e.fila)}</td>
                      <td className="px-3 py-2 font-mono">{e.identificador}</td>
                      <td className="px-3 py-2 text-ink-2">{e.columna}</td>
                      <td className="px-3 py-2 text-ink">{e.mensaje}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {paginas > 1 && (
              <div className="flex items-center gap-2 border-t border-line-2 px-3.5 py-2 text-[12.5px] text-ink-3">
                <span>
                  {fmt((pag - 1) * ERRORES_POR_PAGINA + 1)}–{fmt(Math.min(pag * ERRORES_POR_PAGINA, filtrados.length))} de{" "}
                  {fmt(filtrados.length)}
                </span>
                <Button size="sm" variant="ghost" className="ml-auto" disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>
                  Anterior
                </Button>
                <Button size="sm" variant="secondary" disabled={pag >= paginas} onClick={() => setPagina(pag + 1)}>
                  Siguiente
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function Fila({ etiqueta, valor, tono }: { etiqueta: string; valor: string; tono?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-2">{etiqueta}</span>
      <span className={`font-mono font-semibold ${tono ?? "text-ink"}`}>{valor}</span>
    </div>
  );
}
