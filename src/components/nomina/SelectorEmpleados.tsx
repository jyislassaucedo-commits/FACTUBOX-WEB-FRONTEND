"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Pill, SearchInput, useToast } from "@/components/ui";
import { etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import type { CandidatoNomina } from "@/lib/nomina";

/**
 * A quién le toca cobrar en esta corrida.
 *
 * Existe porque correr la nómina no puede asumir que se le paga a todos: un
 * aguinaldo no se reparte igual ni siempre de una vez, y una corrida puede ser
 * a propósito de unos cuantos.
 *
 * Vienen marcados los de la periodicidad del periodo, que es lo que casi
 * siempre se quiere. Pero se puede desmarcar a cualquiera, y también incluir a
 * quien no coincide —el aguinaldo de alguien que cobra semanal— o a quien ya
 * está dado de baja, que es como se paga un finiquito.
 */
export function SelectorEmpleados({
  rfc,
  idPeriodo,
  periodicidad,
  onClose,
  onCorrer,
}: {
  rfc: string;
  idPeriodo: string;
  periodicidad: string;
  onClose: () => void;
  onCorrer: (ids: string[]) => void;
}) {
  const toast = useToast();
  const [candidatos, setCandidatos] = useState<CandidatoNomina[] | null>(null);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    let vivo = true;
    fetch(`/api/empresas/${encodeURIComponent(rfc)}/nomina/${idPeriodo}/candidatos`)
      .then((r) => r.json())
      .then((body) => {
        if (!vivo) return;
        const lista: CandidatoNomina[] = body.candidatos ?? [];
        setCandidatos(lista);

        // Con la corrida ya armada, lo preseleccionado es QUIEN ESTÁ EN ELLA,
        // no el barrido por periodicidad. Si no, quitar a alguien no serviría
        // de nada: al volver a abrir aparecería marcado otra vez y volvería a
        // entrar, deshaciendo la decisión sin avisar.
        //
        // Solo la primera vez, cuando no hay nadie, se propone el barrido.
        const yaArmada = lista.some((c) => c.YaTieneRecibo === "1");
        setElegidos(
          new Set(
            lista
              .filter((c) =>
                c.Timbrado === "1"
                  ? false
                  : yaArmada
                    ? c.YaTieneRecibo === "1"
                    : c.Coincide === "1" && c.DadoDeBaja === "0"
              )
              .map((c) => c.Id)
          )
        );
      })
      .catch(() => toast("No se pudo cargar la lista de empleados", "danger"));
    return () => {
      vivo = false;
    };
  }, [rfc, idPeriodo, toast]);

  const filtrados = useMemo(() => {
    if (candidatos === null) return [];
    const query = q.trim().toLowerCase();
    if (!query) return candidatos;
    return candidatos.filter((c) =>
      `${c.Nombre} ${c.Rfc} ${c.NumEmpleado} ${c.Puesto}`.toLowerCase().includes(query)
    );
  }, [candidatos, q]);

  function alternar(id: string) {
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  const listos = filtrados.filter((c) => c.Timbrado === "0");
  const yaArmada = (candidatos ?? []).some((c) => c.YaTieneRecibo === "1");
  const todosMarcados = listos.length > 0 && listos.every((c) => elegidos.has(c.Id));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">¿A quién le toca?</h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              {yaArmada
                ? "Vienen marcados los que ya están en la corrida. Marca a quien quieras agregar o desmarca a quien no cobre esta vez."
                : `Vienen marcados los de periodicidad ${etiquetaPeriodicidad(periodicidad).toLowerCase()}. Puedes incluir a cualquier otro o quitar a quien no cobre esta vez.`}
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-3 hover:text-ink">
            Cerrar
          </button>
        </div>

        <div className="flex items-center gap-3 border-b border-line-2 px-5 py-3">
          <SearchInput placeholder="Buscar por nombre, RFC o puesto…" value={q}
            onChange={(e) => setQ(e.target.value)} />
          <button type="button"
            onClick={() =>
              setElegidos((prev) => {
                const s = new Set(prev);
                for (const c of listos) {
                  if (todosMarcados) s.delete(c.Id);
                  else s.add(c.Id);
                }
                return s;
              })
            }
            className="shrink-0 text-[12.5px] font-semibold text-brand hover:underline">
            {todosMarcados ? "Desmarcar todos" : "Marcar todos"}
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {candidatos === null ? (
            <p className="py-8 text-center text-[12.5px] text-ink-3">Cargando empleados…</p>
          ) : filtrados.length === 0 ? (
            <p className="py-8 text-center text-[12.5px] text-ink-3">
              {candidatos.length === 0 ? "Este emisor no tiene empleados." : "Nadie coincide."}
            </p>
          ) : (
            <ul className="space-y-1">
              {filtrados.map((c) => {
                const bloqueado = c.Timbrado === "1";
                const marcado = elegidos.has(c.Id);
                return (
                  <li key={c.Id}>
                    <label className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-2.5 transition ${
                      bloqueado ? "cursor-not-allowed border-line bg-surface-2 opacity-60"
                        : marcado ? "border-brand bg-brand-050" : "border-line-2 hover:border-ink-4"}`}>
                      <input type="checkbox" checked={marcado} disabled={bloqueado}
                        onChange={() => alternar(c.Id)} className="h-4 w-4 shrink-0 accent-[var(--brand)]" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-semibold text-ink">{c.Nombre}</span>
                        <span className="block truncate font-mono text-[11.3px] text-ink-3">
                          {c.Rfc}{c.NumEmpleado ? ` · #${c.NumEmpleado}` : ""}
                          {c.Puesto ? ` · ${c.Puesto}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {c.SalarioDiario && parseFloat(c.SalarioDiario) > 0 && (
                          <span className="font-mono text-[11.5px] text-ink-3">
                            {pesos(c.SalarioDiario)}/día
                          </span>
                        )}
                        {bloqueado && <Pill tone="ok">timbrado</Pill>}
                        {!bloqueado && c.YaTieneRecibo === "1" && (
                          <Pill tone="teal">en la corrida</Pill>
                        )}
                        {!bloqueado && c.DadoDeBaja === "1" && <Pill tone="neutral">de baja</Pill>}
                        {!bloqueado && c.Coincide === "0" && (
                          <Pill tone="info" title={`Su nómina es ${etiquetaPeriodicidad(c.PeriodicidadPago).toLowerCase()}`}>
                            {etiquetaPeriodicidad(c.PeriodicidadPago)}
                          </Pill>
                        )}
                        {!bloqueado && c.Faltantes.length > 0 && (
                          <Pill tone="warn" title={c.Faltantes.map((f) => f.mensaje).join(" ")}>
                            faltan {c.Faltantes.length}
                          </Pill>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3.5">
          <p className="text-[12px] text-ink-3">
            {elegidos.size} {elegidos.size === 1 ? "empleado elegido" : "empleados elegidos"}.
            {yaArmada
              ? " A quien desmarques hay que quitarlo desde su renglón; aquí solo se agrega y se recalcula."
              : " A quien no marques no se le toca el recibo que ya tuviera."}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose}
              className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2">
              Cancelar
            </button>
            <Button variant="primary" disabled={elegidos.size === 0}
              onClick={() => onCorrer([...elegidos])}>
              {yaArmada ? `Aplicar a ${elegidos.size}` : `Correr para ${elegidos.size}`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
