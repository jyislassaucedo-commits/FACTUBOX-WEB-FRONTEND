"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  EmptyState,
  Note,
  Pill,
  RowActions,
  SearchInput,
  Segmented,
  Table,
  Td,
  Th,
  Toolbar,
  useToast,
} from "@/components/ui";
import { inputClass } from "@/components/ui/styles";
import { EmpleadoFormModal } from "./EmpleadoFormModal";
import { iniciales } from "@/lib/emisorNav";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import { textoDe } from "@/lib/catalogosNominaShared";
import type { Empleado, FaltanteEmpleado } from "@/lib/empleados";

/** Lo que el SAT exige y sin lo cual no se le puede timbrar el recibo. Se
 *  calcula aquí además de en el backend porque la lista tiene que poder decir
 *  quién está listo sin preguntar uno por uno. */
function faltantesDe(e: Empleado): string[] {
  const faltan: string[] = [];
  if (!e.Curp?.trim()) faltan.push("CURP");
  if (!e.TipoContrato?.trim()) faltan.push("tipo de contrato");
  if (!e.TipoRegimen?.trim()) faltan.push("tipo de régimen");
  if (!e.NumEmpleado?.trim()) faltan.push("número de empleado");
  if (!e.PeriodicidadPago?.trim()) faltan.push("periodicidad");
  if (!e.ClaveEntFed?.trim()) faltan.push("entidad federativa");
  if (!e.RiesgoPuesto?.trim()) faltan.push("riesgo del puesto");
  if (!e.SalarioDiario || parseFloat(e.SalarioDiario) === 0) faltan.push("salario diario");
  if (
    !e.NumSeguridadSocial?.trim() &&
    ["02", "03", "04"].includes(e.TipoRegimen ?? "")
  ) {
    faltan.push("NSS");
  }
  return faltan;
}

const AVATARES = [
  "text-info bg-info-bg",
  "text-teal bg-teal-bg",
  "text-violet bg-violet-bg",
  "text-ok bg-ok-bg",
  "text-warn bg-warn-bg",
];

function colorDe(clave: string) {
  let hash = 0;
  for (let i = 0; i < clave.length; i++) hash = (hash * 31 + clave.charCodeAt(i)) | 0;
  return AVATARES[Math.abs(hash) % AVATARES.length];
}

function pesos(valor: string | null): string {
  const n = parseFloat(valor ?? "");
  if (!Number.isFinite(n) || n === 0) return "—";
  return n.toLocaleString("es-MX", { style: "currency", currency: "MXN" });
}

/**
 * El registro patronal de la empresa, editable en su renglón.
 *
 * Vive aquí y no en "Datos generales" porque solo le importa a nómina, y
 * porque es lo primero que hay que tener antes de dar de alta a nadie: el
 * alta de un empleado lo propone ya puesto.
 */
function RegistroPatronal({
  rfcEmisor,
  valorInicial,
}: {
  rfcEmisor: string;
  valorInicial: string;
}) {
  const toast = useToast();
  const [valor, setValor] = useState(valorInicial);
  const [guardando, setGuardando] = useState(false);
  const sucio = valor.trim() !== valorInicial.trim();

  async function guardar() {
    setGuardando(true);
    try {
      const res = await fetch(
        `/api/empresas/${encodeURIComponent(rfcEmisor)}/registro-patronal`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registroPatronal: valor.trim() }),
        }
      );
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo guardar el registro patronal", "danger");
        return;
      }
      toast("Registro patronal guardado");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card>
      <CardBody className="flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-ink-2">
            Registro patronal del IMSS
          </label>
          <input
            className={inputClass}
            value={valor}
            maxLength={20}
            placeholder="Sin capturar"
            onChange={(e) => setValor(e.target.value)}
          />
          <p className="mt-1 text-[11px] text-ink-3">
            Va en cada recibo de nómina. Se propone al dar de alta a un empleado, que puede
            llevar otro si la empresa tiene varios registros.
          </p>
        </div>
        <Button variant="secondary" disabled={!sucio || guardando} onClick={guardar}>
          {guardando ? "Guardando…" : "Guardar"}
        </Button>
      </CardBody>
    </Card>
  );
}

export function EmpleadosSection({
  rfc,
  empleados,
  bajas,
  registroPatronal,
}: {
  rfc: string;
  /** Los que siguen contratados. */
  empleados: Empleado[];
  /** Los dados de baja, para la pestaña de bajas. */
  bajas: Empleado[];
  registroPatronal: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const { catalogos } = useCatalogosNomina();

  const [q, setQ] = useState("");
  const [vista, setVista] = useState<"activos" | "bajas">("activos");
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [modalAbierto, setModalAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<string | null>(null);

  const lista = vista === "activos" ? empleados : bajas;

  const filtrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return lista;
    return lista.filter((e) =>
      `${e.Nombre} ${e.Rfc} ${e.NumEmpleado} ${e.Puesto}`.toLowerCase().includes(query)
    );
  }, [lista, q]);

  const incompletos = empleados.filter((e) => faltantesDe(e).length > 0);

  async function cambiarEstado(empleado: Empleado, reactivar: boolean) {
    setOcupado(empleado.Id);
    try {
      const url =
        `/api/empresas/${encodeURIComponent(rfc)}/empleados/${empleado.Id}` +
        (reactivar ? "?reactivar=1" : "");
      const res = await fetch(url, { method: "DELETE" });
      const body = await res.json();

      if (!res.ok) {
        toast(body.error ?? "No se pudo actualizar el empleado", "danger");
        return;
      }
      toast(reactivar ? "Empleado reactivado" : "Empleado dado de baja");
      router.refresh();
    } finally {
      setOcupado(null);
    }
  }

  function alGuardar(faltantes: FaltanteEmpleado[], creado: boolean) {
    setModalAbierto(false);
    setEditando(null);
    if (faltantes.length > 0) {
      toast(
        `${creado ? "Empleado dado de alta" : "Cambios guardados"}, pero le faltan ${faltantes.length} datos para timbrarle`,
        "danger"
      );
    } else {
      toast(creado ? "Empleado dado de alta" : "Cambios guardados");
    }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <RegistroPatronal rfcEmisor={rfc} valorInicial={registroPatronal} />

      {incompletos.length > 0 && (
        <Note
          tone="warn"
          title={
            incompletos.length === 1
              ? "Un empleado no se puede timbrar todavía"
              : `${incompletos.length} empleados no se pueden timbrar todavía`
          }
        >
          Les falta algo que el SAT exige en el recibo. No impide tenerlos dados de alta, pero
          sí emitirles nómina: {incompletos.slice(0, 3).map((e) => e.Nombre).join(", ")}
          {incompletos.length > 3 && ` y ${incompletos.length - 3} más`}.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Empleados"
          description="Se capturan una vez. Después solo hay que correrles la nómina."
          action={
            <Button
              variant="primary"
              onClick={() => {
                setEditando(null);
                setModalAbierto(true);
              }}
            >
              Agregar empleado
            </Button>
          }
        />

        <Toolbar>
          <SearchInput
            placeholder="Buscar por nombre, RFC, número o puesto…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Segmented
            ariaLabel="Ver activos o bajas"
            value={vista}
            onChange={setVista}
            options={[
              { value: "activos", label: `Activos (${empleados.length})` },
              { value: "bajas", label: `Bajas (${bajas.length})` },
            ]}
          />
        </Toolbar>

        {filtrados.length === 0 ? (
          <EmptyState
            title={
              lista.length === 0
                ? vista === "activos"
                  ? "Sin empleados todavía"
                  : "Nadie dado de baja"
                : "Ningún empleado coincide"
            }
            description={
              lista.length === 0
                ? vista === "activos"
                  ? "Da de alta a tu plantilla para no recapturarla en cada recibo."
                  : "Los empleados que des de baja aparecerán aquí, con sus recibos intactos."
                : "Prueba con otro nombre, RFC o puesto."
            }
            action={
              lista.length === 0 && vista === "activos" ? (
                <Button
                  variant="primary"
                  onClick={() => {
                    setEditando(null);
                    setModalAbierto(true);
                  }}
                >
                  Agregar el primero
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Empleado</Th>
                <Th>RFC</Th>
                <Th>Puesto</Th>
                <Th>Periodicidad</Th>
                <Th className="text-right">Salario diario</Th>
                <Th>Estado</Th>
                <Th className="w-40" />
              </tr>
            </thead>
            <tbody>
              {filtrados.map((e) => {
                const faltan = faltantesDe(e);
                const dadoDeBaja = e.FechaBaja !== null;
                return (
                  <tr key={e.Id} className="group transition hover:bg-surface-2">
                    <Td>
                      <span className="flex items-center gap-3">
                        <span
                          className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[10.5px] font-bold ${colorDe(e.Rfc || e.Nombre)}`}
                          aria-hidden
                        >
                          {iniciales(e.Nombre)}
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.3px] font-semibold text-ink">
                            {e.Nombre}
                          </span>
                          <span className="block truncate text-[11.3px] text-ink-3">
                            {e.NumEmpleado ? `#${e.NumEmpleado}` : "sin número"}
                            {e.Email ? ` · ${e.Email}` : ""}
                          </span>
                        </span>
                      </span>
                    </Td>
                    <Td className="font-mono text-[12.5px]">{e.Rfc}</Td>
                    <Td className="text-[12.5px] text-ink-2">
                      {e.Puesto || <span className="text-ink-3">—</span>}
                    </Td>
                    <Td className="text-[12.5px] text-ink-2">
                      {e.PeriodicidadPago ? (
                        <span title={textoDe(catalogos.periodicidadesPagos, e.PeriodicidadPago)}>
                          {textoDe(catalogos.periodicidadesPagos, e.PeriodicidadPago) ||
                            e.PeriodicidadPago}
                        </span>
                      ) : (
                        <span className="text-ink-3">—</span>
                      )}
                    </Td>
                    <Td className="text-right font-mono text-[12.5px]">
                      {pesos(e.SalarioDiario)}
                    </Td>
                    <Td>
                      {dadoDeBaja ? (
                        <Pill tone="neutral" title={`Baja el ${e.FechaBaja}`}>
                          baja
                        </Pill>
                      ) : faltan.length > 0 ? (
                        <Pill tone="warn" title={`Falta: ${faltan.join(", ")}`}>
                          faltan {faltan.length}
                        </Pill>
                      ) : (
                        <Pill tone="ok">listo</Pill>
                      )}
                    </Td>
                    <Td>
                      <RowActions>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditando(e);
                            setModalAbierto(true);
                          }}
                        >
                          Editar
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={ocupado === e.Id}
                          onClick={() => cambiarEstado(e, dadoDeBaja)}
                        >
                          {ocupado === e.Id ? "…" : dadoDeBaja ? "Reactivar" : "Dar de baja"}
                        </Button>
                      </RowActions>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <CardBody className="border-t border-line-2 py-3 text-[12px] text-ink-3">
          Mostrando {filtrados.length} de {lista.length}{" "}
          {vista === "activos" ? "empleados activos" : "bajas"}. Dar de baja no borra nada: los
          recibos ya timbrados siguen siendo suyos.
        </CardBody>
      </Card>

      {modalAbierto && (
        <EmpleadoFormModal
          rfcEmisor={rfc}
          empleado={editando}
          registroPatronalEmpresa={registroPatronal}
          onClose={() => {
            setModalAbierto(false);
            setEditando(null);
          }}
          onSaved={alGuardar}
        />
      )}
    </div>
  );
}
