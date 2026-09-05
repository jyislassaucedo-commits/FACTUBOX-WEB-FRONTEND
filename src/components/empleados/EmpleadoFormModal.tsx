"use client";

import { useState } from "react";
import { inputClass } from "@/components/ui/styles";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import {
  estadosParaSelect,
  soloVigentes,
  type EntradaCatalogoNomina,
} from "@/lib/catalogosNominaShared";
import type { Empleado, EmpleadoInput, FaltanteEmpleado } from "@/lib/empleados";

/**
 * Alta y edición de un empleado.
 *
 * Pide poco para guardar — RFC, nombre y fecha de ingreso — y lo demás lo
 * marca como "lo pide el SAT" sin bloquear. Un empleado se captura por partes:
 * el NSS llega días después del alta y el número de cuenta cuando el banco
 * responde. Obligar a tenerlo todo el primer día solo consigue que la lista se
 * lleve en un papel aparte hasta que esté completa.
 */

const VACIO: EmpleadoInput = {
  rfc: "",
  nombre: "",
  fechaInicioRelLaboral: "",
  curp: "",
  numSeguridadSocial: "",
  domicilioFiscal: "",
  regimenFiscal: "605",
  tipoContrato: "",
  sindicalizado: "No",
  tipoJornada: "",
  tipoRegimen: "",
  numEmpleado: "",
  departamento: "",
  puesto: "",
  riesgoPuesto: "",
  periodicidadPago: "",
  banco: "",
  cuentaBancaria: "",
  salarioBaseCotApor: "",
  salarioDiarioIntegrado: "",
  claveEntFed: "",
  salarioDiario: "",
  registroPatronal: "",
  email: "",
};

/** Pasa un empleado ya guardado a los valores del formulario. */
function desdeEmpleado(e: Empleado): EmpleadoInput {
  return {
    rfc: e.Rfc ?? "",
    nombre: e.Nombre ?? "",
    fechaInicioRelLaboral: e.FechaInicioRelLaboral ?? "",
    curp: e.Curp ?? "",
    numSeguridadSocial: e.NumSeguridadSocial ?? "",
    domicilioFiscal: e.DomicilioFiscal ?? "",
    regimenFiscal: e.RegimenFiscal || "605",
    tipoContrato: e.TipoContrato ?? "",
    sindicalizado: e.Sindicalizado || "No",
    tipoJornada: e.TipoJornada ?? "",
    tipoRegimen: e.TipoRegimen ?? "",
    numEmpleado: e.NumEmpleado ?? "",
    departamento: e.Departamento ?? "",
    puesto: e.Puesto ?? "",
    riesgoPuesto: e.RiesgoPuesto ?? "",
    periodicidadPago: e.PeriodicidadPago ?? "",
    banco: e.Banco ?? "",
    cuentaBancaria: e.CuentaBancaria ?? "",
    // Los importes vienen como "0.00" cuando nunca se capturaron: en una
    // columna NOT NULL ese cero es la forma de decir "aun no", y mostrarlo
    // haria que el usuario lo tome por un dato real.
    salarioBaseCotApor: importe(e.SalarioBaseCotApor),
    salarioDiarioIntegrado: importe(e.SalarioDiarioIntegrado),
    claveEntFed: e.ClaveEntFed ?? "",
    salarioDiario: importe(e.SalarioDiario),
    registroPatronal: e.RegistroPatronal ?? "",
    email: e.Email ?? "",
  };
}

function importe(valor: string | null): string {
  if (valor === null) return "";
  const n = parseFloat(valor);
  return Number.isFinite(n) && n !== 0 ? String(n) : "";
}

/** Campo de texto con etiqueta y, opcionalmente, la marca de "lo pide el SAT". */
function Campo({
  etiqueta,
  ayuda,
  faltante,
  children,
}: {
  etiqueta: string;
  ayuda?: string;
  faltante?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 flex items-baseline gap-1.5 text-xs font-medium text-ink-2">
        {etiqueta}
        {faltante && (
          <span className="text-[10.5px] font-semibold text-warn" title="El SAT lo exige para timbrar">
            lo pide el SAT
          </span>
        )}
      </label>
      {children}
      {ayuda && <p className="mt-1 text-[11px] text-ink-3">{ayuda}</p>}
    </div>
  );
}

/** Select alimentado por un catálogo del SAT: muestra clave y descripción. */
function SelectCatalogo({
  opciones,
  value,
  onChange,
  vacio = "Selecciona…",
}: {
  opciones: EntradaCatalogoNomina[];
  value: string;
  onChange: (v: string) => void;
  vacio?: string;
}) {
  // Una clave que dejo de estar vigente se sigue ofreciendo si el empleado ya
  // la tenia: quitarla de la lista la borraria en silencio al guardar.
  const vigentes = soloVigentes(opciones);
  const lista =
    value && !vigentes.some((o) => o.id === value)
      ? [...opciones.filter((o) => o.id === value), ...vigentes]
      : vigentes;

  return (
    <select className={inputClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{vacio}</option>
      {lista.map((o) => (
        <option key={o.id} value={o.id}>
          {o.id} - {o.texto}
        </option>
      ))}
    </select>
  );
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="rounded-xl border border-line-2 p-3.5">
      <legend className="px-1.5 text-[11.5px] font-semibold uppercase tracking-wide text-ink-3">
        {titulo}
      </legend>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

export function EmpleadoFormModal({
  rfcEmisor,
  empleado,
  registroPatronalEmpresa,
  onClose,
  onSaved,
}: {
  rfcEmisor: string;
  /** null = alta. Con empleado = edición por Id, que es el único camino que
   *  permite corregir un RFC mal capturado. */
  empleado: Empleado | null;
  /** El de la empresa, para proponerlo en un alta y no teclearlo cada vez. */
  registroPatronalEmpresa: string;
  onClose: () => void;
  onSaved: (faltantes: FaltanteEmpleado[], creado: boolean) => void;
}) {
  const { catalogos, cargando } = useCatalogosNomina();
  const [values, setValues] = useState<EmpleadoInput>(() =>
    empleado
      ? desdeEmpleado(empleado)
      : { ...VACIO, registroPatronal: registroPatronalEmpresa }
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const editando = empleado !== null;
  function set(cambios: Partial<EmpleadoInput>) {
    setValues((prev) => ({ ...prev, ...cambios }));
  }

  // El NSS solo lo exige el SAT cuando hay régimen del IMSS de por medio; en
  // asimilados a salarios no lo pide. Misma regla que EmpleadoJson.php.
  const exigeNss = ["02", "03", "04"].includes(values.tipoRegimen ?? "");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const input: EmpleadoInput = {
        ...values,
        rfc: values.rfc.trim().toUpperCase(),
        nombre: values.nombre.trim(),
        curp: values.curp?.trim().toUpperCase(),
        email: values.email?.trim(),
      };

      const base = `/api/empresas/${encodeURIComponent(rfcEmisor)}/empleados`;
      const res = await fetch(editando ? `${base}/${empleado.Id}` : base, {
        method: editando ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo guardar el empleado");
        return;
      }

      onSaved(body.faltantes ?? [], body.creado === true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 flex max-h-[92vh] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-xl bg-surface shadow-pop">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {editando ? "Editar empleado" : "Nuevo empleado"}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-3">
              Se captura una vez. Después solo hay que correrle la nómina.
            </p>
          </div>
          <button type="button" onClick={onClose} className="text-sm text-ink-3 hover:text-ink">
            Cerrar
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 space-y-3.5 overflow-y-auto px-5 py-4">
            <Seccion titulo="Identidad">
              <Campo etiqueta="RFC">
                <input
                  className={inputClass}
                  value={values.rfc}
                  required
                  maxLength={13}
                  onChange={(e) => set({ rfc: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="CURP" faltante={!values.curp?.trim()}>
                <input
                  className={inputClass}
                  value={values.curp}
                  maxLength={18}
                  onChange={(e) => set({ curp: e.target.value })}
                />
              </Campo>
              <Campo
                etiqueta="Fecha de ingreso"
                ayuda="Sin ella no se puede guardar."
              >
                <input
                  type="date"
                  className={inputClass}
                  value={values.fechaInicioRelLaboral}
                  required
                  onChange={(e) => set({ fechaInicioRelLaboral: e.target.value })}
                />
              </Campo>
              <div className="sm:col-span-2">
                <Campo etiqueta="Nombre completo">
                  <input
                    className={inputClass}
                    value={values.nombre}
                    required
                    onChange={(e) => set({ nombre: e.target.value })}
                  />
                </Campo>
              </div>
              <Campo etiqueta="Correo (opcional)" ayuda="Para mandarle su recibo.">
                <input
                  type="email"
                  className={inputClass}
                  value={values.email}
                  onChange={(e) => set({ email: e.target.value })}
                />
              </Campo>
            </Seccion>

            <Seccion titulo="Puesto y contrato">
              <Campo etiqueta="Número de empleado" faltante={!values.numEmpleado?.trim()}>
                <input
                  className={inputClass}
                  value={values.numEmpleado}
                  maxLength={10}
                  onChange={(e) => set({ numEmpleado: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Puesto">
                <input
                  className={inputClass}
                  value={values.puesto}
                  onChange={(e) => set({ puesto: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Departamento">
                <input
                  className={inputClass}
                  value={values.departamento}
                  onChange={(e) => set({ departamento: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Tipo de contrato" faltante={!values.tipoContrato}>
                <SelectCatalogo
                  opciones={catalogos.tiposContratos}
                  value={values.tipoContrato ?? ""}
                  onChange={(v) => set({ tipoContrato: v })}
                />
              </Campo>
              <Campo etiqueta="Tipo de régimen" faltante={!values.tipoRegimen}>
                <SelectCatalogo
                  opciones={catalogos.tiposRegimenes}
                  value={values.tipoRegimen ?? ""}
                  onChange={(v) => set({ tipoRegimen: v })}
                />
              </Campo>
              <Campo etiqueta="Tipo de jornada">
                <SelectCatalogo
                  opciones={catalogos.tiposJornadas}
                  value={values.tipoJornada ?? ""}
                  onChange={(v) => set({ tipoJornada: v })}
                />
              </Campo>
              <Campo etiqueta="Riesgo del puesto" faltante={!values.riesgoPuesto}>
                <SelectCatalogo
                  opciones={catalogos.riesgosPuestos}
                  value={values.riesgoPuesto ?? ""}
                  onChange={(v) => set({ riesgoPuesto: v })}
                />
              </Campo>
              <Campo etiqueta="Sindicalizado">
                <select
                  className={inputClass}
                  value={values.sindicalizado}
                  onChange={(e) => set({ sindicalizado: e.target.value })}
                >
                  <option value="No">No</option>
                  <option value="Sí">Sí</option>
                </select>
              </Campo>
              <Campo etiqueta="Entidad federativa" faltante={!values.claveEntFed}>
                <SelectCatalogo
                  opciones={estadosParaSelect(catalogos.estados)}
                  value={values.claveEntFed ?? ""}
                  onChange={(v) => set({ claveEntFed: v })}
                />
              </Campo>
            </Seccion>

            <Seccion titulo="Pago">
              <Campo etiqueta="Periodicidad de pago" faltante={!values.periodicidadPago}>
                <SelectCatalogo
                  opciones={catalogos.periodicidadesPagos}
                  value={values.periodicidadPago ?? ""}
                  onChange={(v) => set({ periodicidadPago: v })}
                />
              </Campo>
              <Campo
                etiqueta="Salario diario"
                faltante={!values.salarioDiario?.trim()}
                ayuda="Con este se calcula el pago."
              >
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={values.salarioDiario}
                  onChange={(e) => set({ salarioDiario: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Salario base de cotización" ayuda="El que se reporta al IMSS.">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={values.salarioBaseCotApor}
                  onChange={(e) => set({ salarioBaseCotApor: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Salario diario integrado" ayuda="Para indemnizaciones.">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className={inputClass}
                  value={values.salarioDiarioIntegrado}
                  onChange={(e) => set({ salarioDiarioIntegrado: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Banco">
                <SelectCatalogo
                  opciones={catalogos.bancos}
                  value={values.banco ?? ""}
                  onChange={(v) => set({ banco: v })}
                />
              </Campo>
              <Campo etiqueta="Cuenta bancaria">
                <input
                  className={inputClass}
                  value={values.cuentaBancaria}
                  onChange={(e) => set({ cuentaBancaria: e.target.value })}
                />
              </Campo>
            </Seccion>

            <Seccion titulo="Seguridad social y domicilio">
              <Campo
                etiqueta="Número de seguridad social"
                faltante={exigeNss && !values.numSeguridadSocial?.trim()}
                ayuda={exigeNss ? undefined : "No aplica en este tipo de régimen."}
              >
                <input
                  className={inputClass}
                  value={values.numSeguridadSocial}
                  onChange={(e) => set({ numSeguridadSocial: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Registro patronal" ayuda="Se propone el de la empresa.">
                <input
                  className={inputClass}
                  value={values.registroPatronal}
                  maxLength={20}
                  onChange={(e) => set({ registroPatronal: e.target.value })}
                />
              </Campo>
              <Campo etiqueta="Código postal">
                <input
                  className={inputClass}
                  value={values.domicilioFiscal}
                  maxLength={5}
                  onChange={(e) => set({ domicilioFiscal: e.target.value })}
                />
              </Campo>
            </Seccion>

            {cargando && (
              <p className="text-[12px] text-ink-3">Cargando catálogos del SAT…</p>
            )}
            {error && (
              <p className="rounded-md bg-danger-bg px-3 py-2 text-sm text-danger">{error}</p>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3.5">
            <p className="text-[11.5px] text-ink-3">
              Lo marcado como <span className="font-semibold text-warn">lo pide el SAT</span> no
              impide guardar, pero sí timbrar.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-ink-2 hover:bg-line-2"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-[var(--brand)] px-4 py-2 text-sm font-medium text-[var(--brand-ink)] transition hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Guardando…" : editando ? "Guardar cambios" : "Dar de alta"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
