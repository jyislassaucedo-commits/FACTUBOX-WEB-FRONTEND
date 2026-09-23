"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader, Note, buttonClass, cx, useToast } from "@/components/ui";
import { useProgresoManual } from "@/components/carga/useAccionServidor";
import { tipoPlantillaDe, type ModoCaptura } from "@/lib/facturaNueva";
import { guardarRespuesta } from "@/components/masivo/PanelLote";

import type { TipoComprobante } from "@/lib/timbrado";

/* ---------------------------------------------------------------------------
   Una, o muchas de una plantilla.
   ---------------------------------------------------------------------------
   Subir un Excel no es una sección aparte de la aplicación: es otra forma de
   capturar el mismo comprobante. Por eso vive aquí, dentro del asistente, al
   lado de "capturarla a mano", y no en un menú lejano.

   Lo que sube crea un LOTE: se revisa entero antes de timbrar nada y luego se
   sigue en /facturas/lotes/<id>. Este componente no timbra; solo deja el lote
   creado y en revisión.
--------------------------------------------------------------------------- */

export function ElegirModo({
  modo,
  onModo,
  tipo,
  rfcEmisor,
}: {
  modo: ModoCaptura;
  onModo: (m: ModoCaptura) => void;
  tipo: TipoComprobante;
  rfcEmisor: string;
}) {
  return (
    <Card>
      <CardHeader
        title="¿Una o muchas?"
        description="La plantilla de Excel es la misma que usa la aplicación de escritorio."
      />
      <CardBody className="space-y-3">
        <Opcion
          elegida={modo === "una"}
          onElegir={() => onModo("una")}
          titulo="Una, capturándola aquí"
          detalle="El formulario de siempre: emisor, receptor y conceptos."
        />

        <Opcion
          elegida={modo === "plantilla"}
          onElegir={() => onModo("plantilla")}
          titulo="Muchas, desde una plantilla de Excel"
          detalle="Hasta 2,000 comprobantes por archivo. Se revisa antes de timbrar nada."
        >
          <SubirPlantilla tipo={tipo} rfcEmisor={rfcEmisor} />
        </Opcion>
      </CardBody>
    </Card>
  );
}

function Opcion({
  elegida,
  onElegir,
  titulo,
  detalle,
  children,
}: {
  elegida: boolean;
  onElegir: () => void;
  titulo: string;
  detalle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-card border transition",
        elegida ? "border-brand bg-brand-050/40" : "border-line"
      )}
    >
      <label className="flex cursor-pointer items-start gap-3 p-4">
        <input
          type="radio"
          name="modo-captura"
          checked={elegida}
          onChange={onElegir}
          className="mt-1 h-4 w-4 accent-[var(--brand)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-[14.5px] font-semibold text-ink">{titulo}</span>
          <span className="text-[13px] leading-snug text-ink-3">{detalle}</span>
        </span>
      </label>
      {elegida && children && <div className="border-t border-line px-4 py-4">{children}</div>}
    </div>
  );
}

function SubirPlantilla({ tipo, rfcEmisor }: { tipo: TipoComprobante; rfcEmisor: string }) {
  const router = useRouter();
  const toast = useToast();
  const progreso = useProgresoManual();
  const inputRef = useRef<HTMLInputElement>(null);

  const [archivo, setArchivo] = useState<File | null>(null);
  const [serie, setSerie] = useState("");
  const [referencia, setReferencia] = useState("");
  const [correo, setCorreo] = useState(false);
  /**
   * Contra qué PAC se timbra. Se queda en pruebas por omisión a propósito:
   * equivocarse de archivo con 230 facturas contra producción son 230
   * cancelaciones, y contra pruebas no es nada.
   */
  const [modoTimbrado, setModoTimbrado] = useState<"PRUEBAS" | "PRODUCCION">("PRUEBAS");
  const [error, setError] = useState<string | null>(null);
  const [subiendo, setSubiendo] = useState(false);

  const tipoPlantilla = tipoPlantillaDe(tipo);

  async function descargarVacia() {
    const res = await fetch("/api/masivo/plantilla", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // Vertical: es la que admite muchos renglones por comprobante.
      body: JSON.stringify({ rfc: rfcEmisor, tipo: tipoPlantilla, layout: "VERTICAL" }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => null);
      toast(j?.error ?? "No se pudo bajar la plantilla", "danger");
      return;
    }
    // La ruta devuelve el .xlsx ya en bytes, con su nombre en la cabecera.
    await guardarRespuesta(res);
  }

  async function revisar() {
    if (!archivo) {
      setError("Falta el archivo.");
      return;
    }
    setError(null);
    setSubiendo(true);
    const terminar = progreso("Leyendo la plantilla…", true);
    try {
      const fd = new FormData();
      fd.append("rfc", rfcEmisor);
      fd.append("archivo", archivo);
      fd.append("modo", modoTimbrado);
      fd.append("serie", serie);
      fd.append("referencia", referencia || archivo.name);
      if (correo) fd.append("enviarCorreo", "1");

      const res = await fetch("/api/masivo/crear", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok || !body.lote?.IdLote) {
        setError(body.error ?? "No se pudo leer el archivo");
        return;
      }
      // Subir dos veces el mismo archivo devuelve el lote de la primera vez en
      // lugar de duplicarlo. Sin decirlo, el usuario cree que acaba de crear
      // uno nuevo y se encuentra con un lote ya timbrado.
      const aviso = body.lote.Aviso ?? body.lote.Repetido;
      if (aviso) toast(aviso);

      // El lote queda en revisión: nada se timbra hasta confirmarlo en su
      // pantalla, que es donde se ven los errores de captura fila por fila.
      router.push(`/facturas/lotes/${body.lote.IdLote}`);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      terminar();
      setSubiendo(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-[13px] text-ink-3">¿No la tienes?</span>
        <button
          type="button"
          onClick={descargarVacia}
          className="focus-brand rounded text-[13px] font-semibold text-brand hover:underline"
        >
          Descargar plantilla vacía
        </button>
      </div>

      <div
        className={cx(
          "rounded-card border border-dashed px-4 py-6 text-center transition",
          archivo ? "border-brand bg-brand-050/30" : "border-line bg-surface-2"
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx"
          className="sr-only"
          onChange={(e) => {
            setArchivo(e.target.files?.[0] ?? null);
            setError(null);
          }}
        />
        {archivo ? (
          <>
            <p className="text-[14px] font-semibold text-ink">{archivo.name}</p>
            <p className="mt-0.5 text-[12.5px] text-ink-3">
              {(archivo.size / 1024).toFixed(0)} KB
            </p>
          </>
        ) : (
          <p className="text-[14px] font-semibold text-ink">Ningún archivo elegido</p>
        )}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={buttonClass("secondary", "sm", "mt-3")}
        >
          {archivo ? "Cambiar archivo" : "Elegir archivo .xlsx"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ink-2">Serie</span>
          <input
            type="text"
            value={serie}
            onChange={(e) => setSerie(e.target.value)}
            placeholder="La del archivo"
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          />
          <span className="text-[11.5px] text-ink-4">Se usa donde el archivo no traiga una.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ink-2">Referencia</span>
          <input
            type="text"
            value={referencia}
            onChange={(e) => setReferencia(e.target.value)}
            placeholder="Facturación de septiembre"
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          />
          <span className="text-[11.5px] text-ink-4">Para reconocer el lote después.</span>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold text-ink-2">Modo</span>
          <select
            value={modoTimbrado}
            onChange={(e) =>
              setModoTimbrado(e.target.value === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS")
            }
            className="rounded-[10px] border border-line bg-surface px-3 py-2 text-[14px] text-ink outline-none focus:border-brand"
          >
            <option value="PRUEBAS">Pruebas</option>
            <option value="PRODUCCION">Producción</option>
          </select>
          <span className="text-[11.5px] text-ink-4">
            En pruebas no se consumen timbres reales.
          </span>
        </label>
      </div>

      <label className="flex cursor-pointer items-center gap-2">
        <input
          type="checkbox"
          checked={correo}
          onChange={(e) => setCorreo(e.target.checked)}
          className="h-4 w-4 accent-[var(--brand)]"
        />
        <span className="text-[13.5px] text-ink-2">
          Avisar por correo a los receptores que traigan dirección en el archivo
        </span>
      </label>

      {error && <Note tone="danger">{error}</Note>}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={revisar}
          disabled={!archivo || subiendo}
          className={buttonClass("primary")}
        >
          {subiendo ? "Revisando…" : "Revisar el archivo"}
        </button>
        <span className="text-[12.5px] text-ink-3">
          No se timbra nada hasta que lo confirmes.
        </span>
      </div>
    </div>
  );
}
