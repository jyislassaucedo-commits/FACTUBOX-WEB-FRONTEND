"use client";

import { useState } from "react";
import { Pill, useToast } from "@/components/ui";
import { inputClass } from "@/components/ui/styles";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import { soloVigentes } from "@/lib/catalogosNominaShared";
import type { IncidenciaNomina } from "@/lib/nomina";

/**
 * Lo que le pasó a UNA persona en ESTA quincena.
 *
 * Va por empleado y no en una tabla de toda la corrida porque así se captura
 * en la vida real: llega el reporte de que Félix hizo seis horas extra y María
 * faltó dos días, y se busca a cada quien. Una rejilla de veinte renglones por
 * seis tipos de incidencia sería más rápida de llenar solo si todos tuvieran
 * algo, que casi nunca pasa.
 *
 * Capturar no recalcula: se capturan todas y luego se corre la nómina una vez.
 * El modal lo dice al cerrar, porque si no el usuario ve el mismo neto de antes
 * y cree que no se guardó.
 */

const TIPOS = [
  { clave: "FALTA", label: "Falta", ayuda: "No se le pagan esos días." },
  { clave: "INCAPACIDAD", label: "Incapacidad", ayuda: "Sus días los cubre el IMSS, no el patrón." },
  { clave: "HORAS_EXTRA", label: "Horas extra", ayuda: "Se calcula el importe y cuánto va exento." },
  { clave: "VACACIONES", label: "Vacaciones", ayuda: "Se pagan normal y generan prima del 25%." },
  { clave: "AGUINALDO", label: "Aguinaldo", ayuda: "Sin días ni importe se calculan los que le tocan por antigüedad." },
  { clave: "PERCEPCION", label: "Otra percepción", ayuda: "Un bono, vales, lo que se le pague aparte." },
  { clave: "DEDUCCION", label: "Otra deducción", ayuda: "Un préstamo, pensión alimenticia, cuota sindical." },
] as const;

function resumen(i: IncidenciaNomina): string {
  const d = i.dias ? `${parseFloat(i.dias)} días` : "";
  switch (i.tipo) {
    case "FALTA":
      return `Falta · ${d}`;
    case "INCAPACIDAD":
      return `Incapacidad tipo ${i.tipo_incapacidad} · ${d}${i.importe && parseFloat(i.importe) > 0 ? ` · $${i.importe}` : ""}`;
    case "HORAS_EXTRA":
      return `${i.horas} horas tipo ${i.tipo_horas}${i.dias_horas_extra ? ` en ${i.dias_horas_extra} días` : ""}`;
    case "VACACIONES":
      return `Vacaciones · ${d}`;
    case "AGUINALDO":
      return i.importe && parseFloat(i.importe) > 0
        ? `Aguinaldo · ${i.importe}`
        : d ? `Aguinaldo · ${d}` : "Aguinaldo · los que le tocan";
    default:
      return `${i.concepto || i.clave_sat} · $${i.importe}`;
  }
}

export function IncidenciasModal({
  rfc,
  idPeriodo,
  idEmpleado,
  nombre,
  iniciales,
  onClose,
}: {
  rfc: string;
  idPeriodo: string;
  idEmpleado: string;
  nombre: string;
  iniciales: IncidenciaNomina[];
  /** Se avisa si hubo cambios, para que la corrida sepa que hay que recalcular. */
  onClose: (huboCambios: boolean) => void;
}) {
  const toast = useToast();
  const { catalogos } = useCatalogosNomina();

  const [lista, setLista] = useState<IncidenciaNomina[]>(iniciales);
  const [cambios, setCambios] = useState(false);
  const [tipo, setTipo] = useState<string>("FALTA");
  const [campos, setCampos] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const base = `/api/empresas/${encodeURIComponent(rfc)}/nomina/${idPeriodo}/incidencias`;
  const set = (k: string, v: string) => setCampos((c) => ({ ...c, [k]: v }));

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setGuardando(true);
    try {
      const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEmpleado, tipo, ...campos }),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar");
        return;
      }
      setLista(body.incidencias ?? []);
      setCampos({});
      setCambios(true);
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id: string) {
    const res = await fetch(`${base}?idIncidencia=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await res.json();
    if (!res.ok) {
      toast(body.error ?? "No se pudo borrar", "danger");
      return;
    }
    setLista((l) => l.filter((i) => i.id !== id));
    setCambios(true);
  }

  /** Cada tipo pide lo suyo. Mostrar los seis campos siempre haría que quien
   *  captura una falta tenga que ignorar cinco que no le tocan. */
  function camposDelTipo() {
    if (tipo === "AGUINALDO") {
      // Los dos vacíos es el caso normal: se calculan los días que le tocan
      // por su antigüedad, que es justo la cuenta que nadie quiere hacer.
      return (
        <>
          <Campo etiqueta="Días" ayuda="Vacío: los que le tocan (15 al año, proporcionales).">
            <input type="number" step="0.01" min="0" className={inputClass}
              value={campos.dias ?? ""} onChange={(e) => set("dias", e.target.value)} />
          </Campo>
          <Campo etiqueta="O el importe" ayuda="Si ya lo tienes calculado.">
            <input type="number" step="0.01" min="0" className={inputClass}
              value={campos.importe ?? ""} onChange={(e) => set("importe", e.target.value)} />
          </Campo>
        </>
      );
    }
    if (tipo === "FALTA" || tipo === "VACACIONES") {
      return (
        <Campo etiqueta="Días" ayuda={tipo === "VACACIONES" ? "Se pagan normal; se agrega la prima." : undefined}>
          <input type="number" step="0.5" min="0.5" className={inputClass} required
            value={campos.dias ?? ""} onChange={(e) => set("dias", e.target.value)} />
        </Campo>
      );
    }
    if (tipo === "INCAPACIDAD") {
      return (
        <>
          <Campo etiqueta="Días">
            <input type="number" step="1" min="1" className={inputClass} required
              value={campos.dias ?? ""} onChange={(e) => set("dias", e.target.value)} />
          </Campo>
          <Campo etiqueta="Tipo">
            <select className={inputClass} required value={campos.tipoIncapacidad ?? ""}
              onChange={(e) => set("tipoIncapacidad", e.target.value)}>
              <option value="">Selecciona…</option>
              {soloVigentes(catalogos.tiposIncapacidades).map((o) => (
                <option key={o.id} value={o.id}>{o.id} - {o.texto}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Importe del IMSS" ayuda="Si ya se sabe. Va exento.">
            <input type="number" step="0.01" min="0" className={inputClass}
              value={campos.importe ?? ""} onChange={(e) => set("importe", e.target.value)} />
          </Campo>
        </>
      );
    }
    if (tipo === "HORAS_EXTRA") {
      return (
        <>
          <Campo etiqueta="Horas">
            <input type="number" step="1" min="1" className={inputClass} required
              value={campos.horas ?? ""} onChange={(e) => set("horas", e.target.value)} />
          </Campo>
          <Campo etiqueta="Tipo">
            <select className={inputClass} required value={campos.tipoHoras ?? ""}
              onChange={(e) => set("tipoHoras", e.target.value)}>
              <option value="">Selecciona…</option>
              {soloVigentes(catalogos.tiposHoras).map((o) => (
                <option key={o.id} value={o.id}>{o.id} - {o.texto}</option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="En cuántos días" ayuda="Para el nodo del SAT.">
            <input type="number" step="1" min="1" className={inputClass}
              value={campos.diasHorasExtra ?? ""} onChange={(e) => set("diasHorasExtra", e.target.value)} />
          </Campo>
        </>
      );
    }
    const cat = tipo === "PERCEPCION" ? catalogos.tiposPercepciones : catalogos.tiposDeducciones;
    return (
      <>
        <Campo etiqueta="Clave del SAT">
          <select className={inputClass} required value={campos.claveSat ?? ""}
            onChange={(e) => set("claveSat", e.target.value)}>
            <option value="">Selecciona…</option>
            {soloVigentes(cat).map((o) => (
              <option key={o.id} value={o.id}>{o.id} - {o.texto}</option>
            ))}
          </select>
        </Campo>
        <Campo etiqueta="Concepto">
          <input className={inputClass} value={campos.concepto ?? ""}
            onChange={(e) => set("concepto", e.target.value)} />
        </Campo>
        <Campo etiqueta="Importe">
          <input type="number" step="0.01" min="0.01" className={inputClass} required
            value={campos.importe ?? ""} onChange={(e) => set("importe", e.target.value)} />
        </Campo>
        {tipo === "PERCEPCION" && (
          <Campo etiqueta="De eso, exento" ayuda="Si no lo sabes, déjalo vacío y va todo gravado.">
            <input type="number" step="0.01" min="0" className={inputClass}
              value={campos.importeExento ?? ""} onChange={(e) => set("importeExento", e.target.value)} />
          </Campo>
        )}
      </>
    );
  }

  const ayudaTipo = TIPOS.find((t) => t.clave === tipo)?.ayuda;

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={() => onClose(cambios)} />
      <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Incidencias de {nombre}</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Lo que pasó en esta quincena y en ninguna otra.
            </p>
          </div>
          <button type="button" onClick={() => onClose(cambios)} className="text-sm text-ink-3 hover:text-ink">
            Cerrar
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {lista.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-3">
              Sin incidencias. Su recibo sale con el sueldo completo del periodo.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {lista.map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-3 rounded-xl border border-line-2 px-3.5 py-2.5">
                  <span className="min-w-0">
                    <Pill tone={i.tipo === "DEDUCCION" || i.tipo === "FALTA" ? "warn" : "info"}>
                      {TIPOS.find((t) => t.clave === i.tipo)?.label ?? i.tipo}
                    </Pill>
                    <span className="ml-2 text-[12.5px] text-ink-2">{resumen(i)}</span>
                  </span>
                  <button type="button" onClick={() => quitar(i.id)}
                    className="shrink-0 text-[12px] font-semibold text-danger hover:underline">
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form onSubmit={agregar} className="rounded-xl border border-line-2 p-3.5">
            <p className="mb-2.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
              Agregar
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Campo etiqueta="Qué pasó" ayuda={ayudaTipo}>
                <select className={inputClass} value={tipo}
                  onChange={(e) => { setTipo(e.target.value); setCampos({}); setError(null); }}>
                  {TIPOS.map((t) => (
                    <option key={t.clave} value={t.clave}>{t.label}</option>
                  ))}
                </select>
              </Campo>
              {camposDelTipo()}
            </div>

            {error && (
              <p className="mt-3 rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}

            <div className="mt-3 flex justify-end">
              <button type="submit" disabled={guardando}
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50">
                {guardando ? "Guardando…" : "Agregar"}
              </button>
            </div>
          </form>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="text-[11.5px] text-ink-3">
            {cambios
              ? "Hay cambios. Corre la nómina otra vez para que se reflejen en su recibo."
              : "Capturar no recalcula: se capturan todas y luego se corre la nómina una vez."}
          </p>
          <button type="button" onClick={() => onClose(cambios)}
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2">
            Listo
          </button>
        </div>
      </div>
    </div>
  );
}

function Campo({
  etiqueta,
  ayuda,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-ink-2">{etiqueta}</label>
      {children}
      {ayuda && <p className="mt-1 text-[11px] text-ink-3">{ayuda}</p>}
    </div>
  );
}
