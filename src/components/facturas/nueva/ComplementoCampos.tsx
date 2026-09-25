"use client";

import { useState } from "react";
import { Button, Field, FieldError, Input, Pill, Select, cx } from "@/components/ui";
import { money } from "@/lib/cfdi";
import {
  campoVisible,
  conFilas,
  filasDe,
  problemasDeFila,
  type CampoComplemento,
  type DatosComplemento,
  type DefLista,
  type FilaComplemento,
} from "@/lib/complementos";

/*
   Las piezas del paso de Complementos: un campo genérico (texto, número,
   fecha, catálogo o lista de Ids) y la lista repetible con su editor.

   La lista es la opción C del mockup complementos-listas (aprobada el
   2026-09-25): los renglones resumidos, con lo que le falta a cada uno, y un
   editor debajo que se abre al agregar o al tocar un renglón. Es el mismo
   patrón que "Agregar pago".
*/

export function CampoGenerico({
  campo,
  valor,
  onCambio,
  error,
}: {
  campo: CampoComplemento;
  valor: string;
  onCambio: (v: string) => void;
  error?: string | null;
}) {
  // Un catálogo sin opción vacía siempre trae un valor: no tiene caso decir
  // que es opcional.
  const siempreLleno = campo.opciones !== undefined && !campo.opciones.some((o) => o.value === "");
  return (
    <Field
      label={campo.obligatorio || siempreLleno ? campo.etiqueta : `${campo.etiqueta} (opcional)`}
      hint={campo.ayuda}
    >
      {campo.opciones ? (
        <Select value={valor} onChange={(e) => onCambio(e.target.value)} aria-invalid={Boolean(error)}>
          {campo.opciones.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : campo.tipo === "ids" ? (
        <CampoIds valor={valor} onCambio={onCambio} />
      ) : (
        <Input
          type={campo.tipo === "fecha" ? "date" : campo.tipo === "fechaHora" ? "datetime-local" : undefined}
          value={valor}
          placeholder={campo.placeholder}
          inputMode={campo.numerico ? "decimal" : undefined}
          onChange={(e) => onCambio(campo.mayusculas ? e.target.value.toUpperCase() : e.target.value)}
          aria-invalid={Boolean(error)}
          className={campo.numerico ? "font-mono" : undefined}
        />
      )}
      <FieldError mensaje={error} />
    </Field>
  );
}

/** Una lista corta de Ids numéricos (las contabilidades del INE), como fichas. */
function CampoIds({ valor, onCambio }: { valor: string; onCambio: (v: string) => void }) {
  const [nuevo, setNuevo] = useState("");
  const ids = valor.split(",").map((x) => x.trim()).filter(Boolean);
  const agregar = () => {
    const v = nuevo.trim();
    if (!/^\d{1,6}$/.test(v) || ids.includes(v)) return;
    onCambio([...ids, v].join(","));
    setNuevo("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {ids.map((id) => (
        <span key={id} className="inline-flex items-center gap-1 rounded-full bg-line-2 py-0.5 pl-2.5 pr-1 font-mono text-[12.5px]">
          {id}
          <button
            type="button"
            aria-label={`Quitar ${id}`}
            onClick={() => onCambio(ids.filter((x) => x !== id).join(","))}
            className="focus-brand rounded-full px-1 text-ink-4 hover:text-danger"
          >
            ×
          </button>
        </span>
      ))}
      <Input
        value={nuevo}
        inputMode="numeric"
        placeholder="+ Id"
        className="w-28 font-mono"
        onChange={(e) => setNuevo(e.target.value.replace(/\D/g, "").slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            agregar();
          }
        }}
        onBlur={agregar}
      />
    </div>
  );
}

/** Lo que el editor tiene abierto: el renglón, y cómo estaba antes (null si es nuevo). */
type Abierto = { indice: number; antes: FilaComplemento | null };

export function ListaComplemento({
  lista,
  datos,
  onDatos,
  errorLista,
  mostrarErrores,
}: {
  lista: DefLista;
  datos: DatosComplemento;
  onDatos: (d: DatosComplemento) => void;
  /** El error de la lista entera ("agrega al menos una entidad"). */
  errorLista?: string | null;
  mostrarErrores: boolean;
}) {
  const [abierto, setAbierto] = useState<Abierto | null>(null);
  const filas = filasDe(datos, lista.id);
  const guardar = (nuevas: FilaComplemento[]) => onDatos(conFilas(datos, lista.id, nuevas));
  const Mayus = lista.singular[0].toUpperCase() + lista.singular.slice(1);
  const total = lista.monto ? filas.reduce((s, f) => s + lista.monto!(f), 0) : null;
  const campos = lista.campos.filter((c) => campoVisible(c, datos));

  function agregar() {
    guardar([...filas, { ...lista.porDefecto }]);
    setAbierto({ indice: filas.length, antes: null });
  }
  function quitar(i: number) {
    guardar(filas.filter((_, j) => j !== i));
    setAbierto(null);
  }
  function cambiar(i: number, campo: string, valor: string) {
    guardar(filas.map((f, j) => (j === i ? { ...f, [campo]: valor } : f)));
  }
  function cancelar() {
    if (!abierto) return;
    // Uno nuevo se descarta; uno existente vuelve a como estaba.
    if (abierto.antes === null) guardar(filas.filter((_, j) => j !== abierto.indice));
    else guardar(filas.map((f, j) => (j === abierto.indice ? abierto.antes! : f)));
    setAbierto(null);
  }

  const incompletos = filas.filter((f) => problemasDeFila(lista, f, datos).length > 0).length;
  const enEdicion = abierto !== null && filas[abierto.indice] ? abierto : null;
  const problemasAbierto = enEdicion ? problemasDeFila(lista, filas[enEdicion.indice], datos) : [];

  return (
    <section aria-label={lista.titulo} className="space-y-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] font-semibold text-ink">
          {lista.titulo} · {filas.length}
        </p>
        <p className="text-[12.5px] text-ink-3">
          {total !== null && filas.length > 0 && (
            <>
              Total <span className="font-mono font-semibold text-ink">{money(total)}</span>
            </>
          )}
          {incompletos > 0 && (
            <span className="text-warn">
              {total !== null && filas.length > 0 ? " · " : ""}
              {incompletos} incompleto{incompletos === 1 ? "" : "s"}
            </span>
          )}
        </p>
      </div>
      {lista.ayuda && <p className="text-[12.5px] text-ink-3">{lista.ayuda}</p>}

      {filas.length > 0 && (
        <ul className="overflow-hidden rounded-xl border border-line">
          {filas.map((f, i) => {
            const [titulo, detalle] = lista.resumen(f, datos);
            const faltan = problemasDeFila(lista, f, datos).length;
            const activo = enEdicion?.indice === i;
            return (
              <li key={i} className={cx("flex items-center gap-3 border-t border-line-2 px-3 py-2.5 first:border-t-0", activo && "bg-brand-050")}>
                <button
                  type="button"
                  onClick={() => setAbierto({ indice: i, antes: { ...f } })}
                  disabled={enEdicion !== null && !activo}
                  className="focus-brand flex min-w-0 flex-1 items-center gap-3 rounded text-left disabled:cursor-default"
                >
                  <span className="w-5 flex-none text-[12px] text-ink-4">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-semibold text-ink">{titulo}</span>
                    <span className="block truncate text-[12px] text-ink-3">{detalle}</span>
                  </span>
                  {faltan > 0 && <Pill tone="warn">Falta{faltan === 1 ? "" : "n"} {faltan}</Pill>}
                  {lista.monto && <span className="font-mono text-[13px] font-semibold text-ink">{money(lista.monto(f))}</span>}
                </button>
                <button
                  type="button"
                  aria-label={`Quitar ${lista.singular} ${i + 1}`}
                  onClick={() => quitar(i)}
                  className="focus-brand rounded-md px-1.5 text-[16px] leading-none text-ink-4 hover:bg-danger-bg hover:text-danger"
                >
                  ×
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {enEdicion ? (
        <div className="space-y-3 rounded-xl border-[1.5px] border-brand-100 bg-surface p-3.5">
          <p className="text-[13px] font-semibold text-ink">
            {Mayus} {enEdicion.indice + 1}
            {enEdicion.antes === null && <span className="font-normal text-ink-3"> · nuevo</span>}
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {campos.map((c) => (
              <CampoGenerico
                key={c.id}
                campo={c}
                valor={filas[enEdicion.indice][c.id] ?? ""}
                onCambio={(v) => cambiar(enEdicion.indice, c.id, v)}
                error={mostrarErrores ? problemasAbierto.find((p) => p.campo === c.id)?.mensaje : null}
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={cancelar}>
              Cancelar
            </Button>
            <Button variant="primary" size="sm" onClick={() => setAbierto(null)}>
              Listo
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" size="sm" onClick={agregar} disabled={lista.maximo !== undefined && filas.length >= lista.maximo}>
          + Agregar {lista.singular}
        </Button>
      )}
      <FieldError mensaje={errorLista} />
    </section>
  );
}
