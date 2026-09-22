"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card, CardBody, CardHeader, Note, Pill, SearchInput } from "@/components/ui";
import { cx } from "@/components/ui/styles";
import { etiquetaPeriodicidad, pesos } from "@/lib/nominaShared";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import { textoDe } from "@/lib/catalogosNominaShared";
import type { Empleado } from "@/lib/empleados";

/**
 * A quién se le paga.
 *
 * El receptor sale SIEMPRE de la ficha del empleado, sin campos para
 * corregirla aquí: al timbrar, el backend vuelve a escribir la ficha con lo
 * que vaya en el XML, así que un "ajuste solo para este recibo" acabaría
 * pisando la ficha sin que nadie lo notara. Lo que esté mal se corrige en
 * Empleados y se vuelve.
 *
 * Los dados de baja se muestran: el finiquito es el caso de uso principal de
 * una nómina a mano.
 */
export function PasoEmpleado({
  rfc,
  empleados,
  idEmpleado,
  onElegir,
  mostrarErrores,
  registroPatronalEmpresa,
}: {
  rfc: string;
  empleados: Empleado[];
  idEmpleado: string;
  onElegir: (id: string) => void;
  mostrarErrores: boolean;
  registroPatronalEmpresa: string;
}) {
  const [q, setQ] = useState("");
  const { catalogos } = useCatalogosNomina();
  const actual = empleados.find((e) => e.Id === idEmpleado) ?? null;

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    const lista = query
      ? empleados.filter((e) => `${e.Nombre} ${e.Rfc} ${e.NumEmpleado} ${e.Puesto}`.toLowerCase().includes(query))
      : empleados;
    // Los activos primero; las bajas al final, que se buscan a propósito.
    return [...lista].sort((a, b) => Number(!!a.FechaBaja) - Number(!!b.FechaBaja) || a.Nombre.localeCompare(b.Nombre));
  }, [empleados, q]);

  const faltantes = actual ? faltantesParaCfdi(actual, registroPatronalEmpresa) : [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title="Empleado"
          description="Los datos del recibo salen de su ficha. Si algo está mal, corrígelo en Empleados."
        />
        <CardBody className="space-y-3">
          <SearchInput
            placeholder="Buscar por nombre, RFC o número…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          {mostrarErrores && !actual && (
            <Note tone="warn">Elige al empleado al que se le va a pagar.</Note>
          )}
          {empleados.length === 0 ? (
            <Note tone="warn" title="Todavía no hay empleados">
              Da de alta a tu plantilla en{" "}
              <Link href={`/emisores/${encodeURIComponent(rfc)}/empleados`} className="font-semibold underline">
                Empleados
              </Link>{" "}
              antes de capturar una nómina.
            </Note>
          ) : (
            <ul className="max-h-[360px] divide-y divide-line-2 overflow-y-auto rounded-xl border border-line">
              {filtrados.map((e) => {
                const elegido = e.Id === idEmpleado;
                return (
                  <li key={e.Id}>
                    <button
                      type="button"
                      onClick={() => onElegir(e.Id)}
                      aria-pressed={elegido}
                      className={cx(
                        "focus-brand flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left transition hover:bg-surface-2",
                        elegido && "bg-brand-050"
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13.3px] font-semibold text-ink">{e.Nombre}</span>
                        <span className="block font-mono text-[11.3px] text-ink-3">
                          {e.Rfc}
                          {e.NumEmpleado ? ` · #${e.NumEmpleado}` : ""}
                          {e.Puesto ? ` · ${e.Puesto}` : ""}
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-1.5">
                        {e.FechaBaja && <Pill tone="warn">baja {e.FechaBaja}</Pill>}
                        {e.PeriodicidadPago && <Pill tone="neutral">{etiquetaPeriodicidad(e.PeriodicidadPago)}</Pill>}
                        {elegido && <Pill tone="brand">elegido</Pill>}
                      </span>
                    </button>
                  </li>
                );
              })}
              {filtrados.length === 0 && (
                <li className="px-3.5 py-6 text-center text-[12.5px] text-ink-3">Nadie coincide con la búsqueda.</li>
              )}
            </ul>
          )}
        </CardBody>
      </Card>

      {actual && (
        <Card>
          <CardHeader
            title={actual.Nombre}
            description="Así va a salir en el recibo."
            action={
              <Link
                href={`/emisores/${encodeURIComponent(rfc)}/empleados`}
                className="text-[12.5px] font-semibold text-brand hover:underline"
              >
                Editar ficha
              </Link>
            }
          />
          <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            <Dato etiqueta="RFC" valor={actual.Rfc} mono />
            <Dato etiqueta="CURP" valor={actual.Curp} mono />
            <Dato etiqueta="No. de empleado" valor={actual.NumEmpleado} />
            <Dato etiqueta="NSS" valor={actual.NumSeguridadSocial} mono />
            <Dato etiqueta="Régimen" valor={conTexto(actual.TipoRegimen, textoDe(catalogos.tiposRegimenes, actual.TipoRegimen))} />
            <Dato etiqueta="Contrato" valor={conTexto(actual.TipoContrato, textoDe(catalogos.tiposContratos, actual.TipoContrato))} />
            <Dato etiqueta="Periodicidad" valor={etiquetaPeriodicidad(actual.PeriodicidadPago)} />
            <Dato etiqueta="Inicio de relación laboral" valor={actual.FechaInicioRelLaboral?.slice(0, 10) ?? ""} mono />
            <Dato etiqueta="Salario diario" valor={actual.SalarioDiario ? pesos(actual.SalarioDiario) : ""} mono />
            <Dato etiqueta="Entidad" valor={actual.ClaveEntFed} />
            <Dato
              etiqueta="Registro patronal"
              valor={actual.RegistroPatronal || (registroPatronalEmpresa ? `${registroPatronalEmpresa} (el de la empresa)` : "")}
              mono
            />
            <Dato etiqueta="Banco / cuenta" valor={[actual.Banco, actual.CuentaBancaria].filter(Boolean).join(" · ")} mono />
          </CardBody>
          {faltantes.length > 0 && (
            <CardBody className="border-t border-line-2">
              <Note tone="warn" title="A la ficha le faltan datos que el SAT exige">
                <ul className="mt-1 space-y-1">
                  {faltantes.map((f) => (
                    <li key={f}>· {f}</li>
                  ))}
                </ul>
                <p className="mt-1.5 opacity-80">
                  Se puede seguir capturando, pero no se va a poder timbrar hasta completarlos en{" "}
                  <Link href={`/emisores/${encodeURIComponent(rfc)}/empleados`} className="font-semibold underline">
                    Empleados
                  </Link>
                  .
                </p>
              </Note>
            </CardBody>
          )}
        </Card>
      )}
    </div>
  );
}

/** Lo mismo que revisa NominaCfdi::faltantes() antes de armar el comprobante. */
export function faltantesParaCfdi(e: Empleado, registroPatronalEmpresa: string): string[] {
  const f: string[] = [];
  if (!e.Curp?.trim()) f.push("la CURP");
  if (!e.TipoContrato?.trim()) f.push("el tipo de contrato");
  if (!e.TipoRegimen?.trim()) f.push("el tipo de régimen");
  if (!e.NumEmpleado?.trim()) f.push("el número de empleado");
  if (!e.ClaveEntFed?.trim()) f.push("la entidad federativa");
  if (!e.RegistroPatronal?.trim() && !registroPatronalEmpresa.trim()) f.push("el registro patronal (ni la empresa tiene uno)");
  return f;
}

function conTexto(clave: string, texto: string) {
  return clave ? (texto ? `${clave} - ${texto}` : clave) : "";
}

function Dato({ etiqueta, valor, mono }: { etiqueta: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-dashed border-line-2 py-1">
      <span className="shrink-0 text-[12px] text-ink-3">{etiqueta}</span>
      <span className={cx("min-w-0 truncate text-right text-[12.5px] font-semibold", valor ? "text-ink" : "text-ink-4", mono && "font-mono")}>
        {valor || "—"}
      </span>
    </div>
  );
}
