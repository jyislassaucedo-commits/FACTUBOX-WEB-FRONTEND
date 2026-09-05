"use client";

import { useEffect, useState } from "react";
import { Button, Modal, Note } from "@/components/ui";
import { dias, etiquetaPeriodicidad } from "@/lib/nominaShared";

type Previo = {
  periodo: {
    FechaInicialPago: string;
    FechaFinalPago: string;
    FechaPago: string;
    DiasPagados: string;
    Periodicidad: string;
    Nombre: string | null;
    Descripcion: string | null;
  };
  empleados: number;
  bajas: { IdEmpleado: number; Nombre: string; FechaBaja: string }[];
  fijas: number;
};

/**
 * Repetir una corrida en el periodo que sigue.
 *
 * Antes de crear nada enseña qué haría: las fechas nuevas, a cuánta gente
 * alcanza y quién se dio de baja en el camino. La quincena que sigue no es
 * "quince días después" -- del 1 al 15 sigue el 16 al fin de mes, que puede
 * ser de 13, 14, 15 o 16 días -- así que las fechas las calcula el backend y
 * aquí sólo se muestran.
 */
export function RepetirCorridaModal({
  rfc,
  idPeriodo,
  onClose,
  onCreada,
}: {
  rfc: string;
  idPeriodo: string;
  onClose: () => void;
  onCreada: (id: string, empleados: number) => void;
}) {
  const [previo, setPrevio] = useState<Previo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copiarFijas, setCopiarFijas] = useState(false);
  const [creando, setCreando] = useState(false);
  /**
   * Lo que salió torcido al calcular, cuando salió algo.
   *
   * Si hay avisos u omitidos el modal se queda: navegar de inmediato los
   * enseñaría medio segundo y los perdería, y son justo el caso en que vale la
   * pena detenerse. Cuando todo sale limpio no estorba y se pasa de largo.
   */
  const [resultado, setResultado] = useState<{
    id: string;
    empleados: number;
    avisos: { Nombre: string; Aviso: string }[];
    omitidos: { Nombre: string; Motivo: string }[];
  } | null>(null);

  const url = `/api/empresas/${encodeURIComponent(rfc)}/nomina/${idPeriodo}/repetir`;

  useEffect(() => {
    let vivo = true;
    (async () => {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ previsualizar: true }),
      });
      const data = await r.json().catch(() => null);
      if (!vivo) return;
      if (!r.ok) {
        setError(data?.error ?? "No se pudo preparar la corrida siguiente");
        return;
      }
      setPrevio(data as Previo);
    })();
    return () => {
      vivo = false;
    };
  }, [url]);

  async function crear() {
    setCreando(true);
    setError(null);
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ copiarFijas }),
    });
    const data = await r.json().catch(() => null);
    if (!r.ok) {
      setError(data?.error ?? "No se pudo crear la corrida");
      setCreando(false);
      return;
    }

    const avisos = data.avisos ?? [];
    const omitidos = data.omitidos ?? [];
    if (avisos.length === 0 && omitidos.length === 0) {
      onCreada(String(data.id), Number(data.empleados ?? 0));
      return;
    }
    setResultado({
      id: String(data.id),
      empleados: Number(data.empleados ?? 0),
      avisos,
      omitidos,
    });
    setCreando(false);
  }

  return (
    <Modal
      title={resultado ? "Corrida creada, pero revisa esto" : "Repetir en el periodo siguiente"}
      onClose={onClose}
      footer={
        resultado ? (
          <Button variant="primary" onClick={() => onCreada(resultado.id, resultado.empleados)}>
            Abrir la corrida
          </Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose} disabled={creando}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={crear} disabled={!previo || creando}>
              {creando ? "Creando…" : "Crear y calcular"}
            </Button>
          </>
        )
      }
    >
      {error && (
        <Note tone="danger" title="No se pudo">
          {error}
        </Note>
      )}

      {resultado && (
        <div className="space-y-3">
          <p className="text-[12.8px] leading-relaxed text-ink-2">
            Se creó con {resultado.empleados}{" "}
            {resultado.empleados === 1 ? "empleado" : "empleados"}. Nada de esto la detiene, pero conviene
            verlo antes de timbrar.
          </p>

          {resultado.omitidos.length > 0 && (
            <Note tone="danger" title={`${resultado.omitidos.length} sin recibo`}>
              <ul className="mt-1 space-y-1">
                {resultado.omitidos.map((o, i) => (
                  <li key={o.Nombre + i}>
                    <span className="font-semibold">{o.Nombre}</span> — {o.Motivo}
                  </li>
                ))}
              </ul>
            </Note>
          )}

          {resultado.avisos.length > 0 && (
            <Note tone="warn" title={`${resultado.avisos.length} con aviso`}>
              <ul className="mt-1 space-y-1">
                {resultado.avisos.map((a, i) => (
                  <li key={a.Nombre + i}>
                    <span className="font-semibold">{a.Nombre}</span> — {a.Aviso}
                  </li>
                ))}
              </ul>
            </Note>
          )}
        </div>
      )}

      {!previo && !error && !resultado && (
        <p className="text-[12.8px] text-ink-3">Calculando el periodo siguiente…</p>
      )}

      {previo && !resultado && (
        <div className="space-y-4">
          <div className="rounded-[11px] border border-line bg-surface-2 px-4 py-3">
            <p className="text-[11.3px] uppercase tracking-wide text-ink-3">
              {previo.periodo.Nombre ? `Periodo nuevo · ${previo.periodo.Nombre}` : "Periodo nuevo"}
            </p>
            <p className="mt-1 text-[15px] font-semibold text-ink">
              {previo.periodo.FechaInicialPago} al {previo.periodo.FechaFinalPago}
            </p>
            <p className="mt-0.5 text-[12.5px] text-ink-2">
              {etiquetaPeriodicidad(previo.periodo.Periodicidad)}, {dias(previo.periodo.DiasPagados)} días · se
              paga el {previo.periodo.FechaPago}
            </p>
          </div>

          <p className="text-[12.8px] leading-relaxed text-ink-2">
            Se lleva a{" "}
            <span className="font-semibold text-ink">
              {previo.empleados} {previo.empleados === 1 ? "empleado" : "empleados"}
            </span>
            , los mismos de la corrida anterior. Las faltas, incapacidades, horas extra, vacaciones y
            aguinaldo <span className="font-semibold text-ink">no</span> se copian: eran de ese periodo.
          </p>

          {previo.fijas > 0 && (
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[11px] border border-line px-3.5 py-3 transition hover:bg-surface-2">
              <input
                type="checkbox"
                checked={copiarFijas}
                onChange={(e) => setCopiarFijas(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-brand"
              />
              <span className="text-[12.8px] leading-relaxed text-ink-2">
                {previo.fijas === 1 ? "Copiar también la " : "Copiar también las "}
                <span className="font-semibold text-ink">
                  {previo.fijas === 1
                    ? "percepción o deducción capturada a mano"
                    : `${previo.fijas} percepciones y deducciones capturadas a mano`}
                </span>{" "}
                (préstamos, pensión alimenticia, vales). Revísala después: un préstamo que ya se terminó de
                pagar seguiría descontándose.
              </span>
            </label>
          )}

          {previo.bajas.length > 0 && (
            <Note tone="warn" title={`${previo.bajas.length} ya no entran`}>
              <ul className="mt-1 space-y-0.5">
                {previo.bajas.map((b) => (
                  <li key={b.IdEmpleado}>
                    {b.Nombre} — baja el {b.FechaBaja}
                  </li>
                ))}
              </ul>
            </Note>
          )}
        </div>
      )}
    </Modal>
  );
}
