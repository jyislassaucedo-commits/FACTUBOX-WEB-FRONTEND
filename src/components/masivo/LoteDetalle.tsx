"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Note } from "@/components/ui";
import {
  intervaloSondeo,
  loteEnCurso,
  type ItemResultado,
  type ResumenLote,
} from "@/lib/masivoShared";
import { PanelLote, guardarRespuesta } from "./PanelLote";

/* ---------------------------------------------------------------------------
   Un lote, con su propia dirección.
   ---------------------------------------------------------------------------
   El flujo tiene un paso que parece de más y no lo es: al subir el archivo el
   lote NO se timbra, queda en revisión. Primero se enseñan los errores de
   captura -- con la celda exacta -- y solo cuando el usuario confirma se gastan
   timbres. Corregir un Excel antes es gratis; después de timbrar cuesta una
   cancelación.

   El lote vive en el servidor, así que cerrar esta pantalla no lo detiene: el
   sondeo solo sirve para ver el avance mientras se mira. Al volver a la URL
   aparece donde iba.
--------------------------------------------------------------------------- */

export function LoteDetalle({
  rfc,
  loteInicial,
  itemsIniciales,
}: {
  rfc: string;
  loteInicial: ResumenLote;
  itemsIniciales: ItemResultado[];
}) {
  const [lote, setLote] = useState<ResumenLote>(loteInicial);
  const [items, setItems] = useState<ItemResultado[]>(itemsIniciales);
  const [error, setError] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);

  /** Cuándo empezó a correr, para espaciar el sondeo conforme se alarga. */
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

  // Sondeo del avance. Se detiene en cuanto el lote deja de poder cambiar solo.
  useEffect(() => {
    if (!loteEnCurso(lote.Estado)) return;
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
      if (!loteEnCurso(r.lote.Estado)) desdeCuando.current = 0;
    }, intervaloSondeo(corriendo));

    return () => clearTimeout(t);
  }, [lote, rfc, cargarResultados]);

  async function accion(accion: "CONFIRMAR" | "CANCELAR" | "REINTENTAR") {
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

  return (
    <div className="space-y-4">
      {error && (
        <Note tone="danger" title="No se pudo">
          {error}
        </Note>
      )}

      <PanelLote
        lote={lote}
        items={items}
        conErrores={items.filter((i) => i.Errores.length > 0)}
        enRevision={lote.Estado === "REVISION"}
        ocupado={ocupado}
        onAccion={accion}
        onDescargar={descargar}
      />
    </div>
  );
}
