"use client";

import { Button, Card, CardBody, CardHeader, FieldError, Input, Note, Segmented, Select } from "@/components/ui";
import { pesos } from "@/lib/nominaShared";
import { useCatalogosNomina } from "@/lib/useCatalogosNomina";
import { textoDe, type EntradaCatalogoNomina } from "@/lib/catalogosNominaShared";
import {
  JUBILACION,
  JUBILACION_VACIA,
  SEPARACION,
  SEPARACION_VACIA,
  llevaSubsidioAutomatico,
  mensajeDe,
  nuevaDeduccion,
  nuevaPercepcion,
  nuevoOtroPago,
  round2,
  type DeduccionManual,
  type HorasExtraManual,
  type NominaManualForm,
  type OtroPagoManual,
  type PercepcionManual,
  type ProblemaManual,
} from "@/lib/nominaManualShared";
import type { Empleado } from "@/lib/empleados";
import { BotonQuitar, Campo, InputDinero, InputEntero, SelectCatalogo, Titulo } from "./campos";

/**
 * Los renglones del recibo, como las pestañas del escritorio pero en una
 * sola pantalla: percepciones, deducciones y otros pagos, cada grupo con su
 * total. Los nodos que el SAT cuelga de un renglón (horas extra en la 019,
 * acciones en la 045, compensación en el 004) aparecen debajo del renglón
 * que los pide, y solo entonces: mostrar siempre todos los campos posibles
 * es la forma más segura de que se llenen los que no van.
 */
export function PasoConceptos({
  form,
  set,
  empleado,
  problemas,
  mostrarErrores,
}: {
  form: NominaManualForm;
  set: (cambio: Partial<NominaManualForm>) => void;
  empleado: Empleado | null;
  problemas: ProblemaManual[];
  mostrarErrores: boolean;
}) {
  const { catalogos } = useCatalogosNomina();
  const err = (campo: string) => (mostrarErrores ? mensajeDe(problemas, campo) : null);

  const hayJubilacion = form.percepciones.some((r) => JUBILACION.includes(r.tipo));
  const haySeparacion = form.percepciones.some((r) => SEPARACION.includes(r.tipo));

  return (
    <div className="space-y-4">
      <PercepcionesEditor
        filas={form.percepciones}
        catalogo={catalogos.tiposPercepciones}
        tiposHoras={catalogos.tiposHoras}
        onChange={(percepciones) => set({ percepciones })}
        err={err}
      />

      {hayJubilacion && (
        <Card>
          <CardHeader
            title="Jubilación, pensión o retiro"
            description="Hay una percepción 039 o 044: el SAT pide este nodo con el detalle del pago."
          />
          <CardBody className="space-y-3">
            <JubilacionFields
              valor={form.jubilacion ?? JUBILACION_VACIA}
              onChange={(jubilacion) => set({ jubilacion })}
              err={err}
            />
          </CardBody>
        </Card>
      )}

      {haySeparacion && (
        <Card>
          <CardHeader
            title="Separación o indemnización"
            description="Hay una percepción 022, 023 o 025: el SAT pide este nodo con el detalle del pago."
          />
          <CardBody className="space-y-3">
            <SeparacionFields
              valor={form.separacion ?? SEPARACION_VACIA}
              onChange={(separacion) => set({ separacion })}
              err={err}
            />
          </CardBody>
        </Card>
      )}

      <DeduccionesEditor
        filas={form.deducciones}
        catalogo={catalogos.tiposDeducciones}
        onChange={(deducciones) => set({ deducciones })}
        err={err}
      />

      <OtrosPagosEditor
        filas={form.otrosPagos}
        catalogo={catalogos.tiposOtrosPagos}
        onChange={(otrosPagos) => set({ otrosPagos })}
        err={err}
        subsidioAutomatico={llevaSubsidioAutomatico(form, empleado)}
        regimen={empleado?.TipoRegimen ?? ""}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Percepciones                                                               */
/* -------------------------------------------------------------------------- */

function PercepcionesEditor({
  filas,
  catalogo,
  tiposHoras,
  onChange,
  err,
}: {
  filas: PercepcionManual[];
  catalogo: EntradaCatalogoNomina[];
  tiposHoras: EntradaCatalogoNomina[];
  onChange: (filas: PercepcionManual[]) => void;
  err: (campo: string) => string | null;
}) {
  const total = round2(filas.reduce((a, r) => a + (Number(r.importeGravado) || 0) + (Number(r.importeExento) || 0), 0));

  function actualizar(i: number, cambio: Partial<PercepcionManual>) {
    onChange(filas.map((r, j) => (j === i ? { ...r, ...cambio } : r)));
  }

  function cambiarTipo(i: number, tipo: string) {
    const r = filas[i];
    // La clave interna y el concepto se proponen desde el catálogo si estaban
    // vacíos o venían del tipo anterior; lo que ya se escribió a mano se respeta.
    const clave = !r.clave || r.clave === r.tipo ? tipo : r.clave;
    const concepto = !r.concepto || r.concepto === textoDe(catalogo, r.tipo) ? textoDe(catalogo, tipo) : r.concepto;
    const cambio: Partial<PercepcionManual> = { tipo, clave, concepto };
    if (tipo === "019" && !r.horasExtra?.length) cambio.horasExtra = [{ dias: "1", tipoHoras: "01", horasExtra: "", importePagado: "" }];
    if (tipo !== "019") cambio.horasExtra = undefined;
    if (tipo === "045" && !r.accionesOTitulos) cambio.accionesOTitulos = { valorMercado: "", precioAlOtorgarse: "" };
    if (tipo !== "045") cambio.accionesOTitulos = undefined;
    if (tipo === "038") cambio.importeExento = "0";
    actualizar(i, cambio);
  }

  return (
    <Card>
      <CardHeader
        title="Percepciones"
        description="Lo que se le paga. Gravado y exento por separado; el ISR se calcula sobre lo gravado."
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-semibold text-ink">{pesos(total)}</span>
            <Button variant="secondary" size="sm" onClick={() => onChange([...filas, nuevaPercepcion()])}>
              Agregar
            </Button>
          </span>
        }
      />
      <CardBody className="space-y-3">
        <FieldError mensaje={err("percepciones")} />
        {filas.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-3">
            Sin percepciones. Agrega el sueldo, o vuelve a Periodo y usa “Proponer desde su ficha”.
          </p>
        )}
        {filas.map((r, i) => {
          const ref = `percepciones[${i}]`;
          return (
            <div key={r.id} className="rounded-xl border border-line-2 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Campo label="Tipo (SAT)" error={err(`${ref}.tipo`)}>
                  <SelectCatalogo lista={catalogo} value={r.tipo} onChange={(t) => cambiarTipo(i, t)} />
                </Campo>
                <Campo label="Clave" error={err(`${ref}.clave`)}>
                  <Input value={r.clave} maxLength={15} onChange={(e) => actualizar(i, { clave: e.target.value })} />
                </Campo>
                <Campo label="Concepto" error={err(`${ref}.concepto`)}>
                  <Input value={r.concepto} maxLength={100} onChange={(e) => actualizar(i, { concepto: e.target.value })} />
                </Campo>
                <Campo label="Gravado" error={err(`${ref}.importeGravado`)}>
                  <InputDinero value={r.importeGravado} onChange={(e) => actualizar(i, { importeGravado: e.target.value })} />
                </Campo>
                <Campo label="Exento" error={err(`${ref}.importeExento`)}>
                  <InputDinero value={r.importeExento} disabled={r.tipo === "038"} onChange={(e) => actualizar(i, { importeExento: e.target.value })} />
                </Campo>
                <div className="flex items-end pb-1.5">
                  <BotonQuitar onClick={() => onChange(filas.filter((_, j) => j !== i))} />
                </div>
              </div>

              {r.tipo === "019" && (
                <HorasExtraEditor
                  filas={r.horasExtra ?? []}
                  tiposHoras={tiposHoras}
                  onChange={(horasExtra) => actualizar(i, { horasExtra })}
                  err={err}
                  refCampo={ref}
                />
              )}

              {r.tipo === "045" && (
                <div className="mt-3 border-t border-dashed border-line-2 pt-3">
                  <Titulo>Acciones o títulos</Titulo>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Campo label="Valor de mercado" error={err(`${ref}.accionesOTitulos`)}>
                      <InputDinero
                        value={r.accionesOTitulos?.valorMercado ?? ""}
                        onChange={(e) => actualizar(i, { accionesOTitulos: { valorMercado: e.target.value, precioAlOtorgarse: r.accionesOTitulos?.precioAlOtorgarse ?? "" } })}
                      />
                    </Campo>
                    <Campo label="Precio al otorgarse">
                      <InputDinero
                        value={r.accionesOTitulos?.precioAlOtorgarse ?? ""}
                        onChange={(e) => actualizar(i, { accionesOTitulos: { valorMercado: r.accionesOTitulos?.valorMercado ?? "", precioAlOtorgarse: e.target.value } })}
                      />
                    </Campo>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function HorasExtraEditor({
  filas,
  tiposHoras,
  onChange,
  err,
  refCampo,
}: {
  filas: HorasExtraManual[];
  tiposHoras: EntradaCatalogoNomina[];
  onChange: (filas: HorasExtraManual[]) => void;
  err: (campo: string) => string | null;
  refCampo: string;
}) {
  function actualizar(j: number, cambio: Partial<HorasExtraManual>) {
    onChange(filas.map((h, k) => (k === j ? { ...h, ...cambio } : h)));
  }
  return (
    <div className="mt-3 border-t border-dashed border-line-2 pt-3">
      <Titulo
        accion={
          <Button variant="ghost" size="sm" onClick={() => onChange([...filas, { dias: "1", tipoHoras: "01", horasExtra: "", importePagado: "" }])}>
            Agregar tipo de hora
          </Button>
        }
      >
        Horas extra (un renglón por tipo)
      </Titulo>
      <FieldError mensaje={err(`${refCampo}.horasExtra`)} />
      <div className="mt-2 space-y-2">
        {filas.map((h, j) => {
          const hr = `${refCampo}.horasExtra[${j}]`;
          return (
            <div key={j} className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
              <Campo label="Días" error={err(`${hr}.dias`)}>
                <InputEntero min="1" value={h.dias} onChange={(e) => actualizar(j, { dias: e.target.value })} />
              </Campo>
              <Campo label="Tipo" error={err(`${hr}.tipoHoras`)}>
                <SelectCatalogo lista={tiposHoras} value={h.tipoHoras} onChange={(t) => actualizar(j, { tipoHoras: t })} />
              </Campo>
              <Campo label="Horas" error={err(`${hr}.horasExtra`)}>
                <InputEntero min="1" value={h.horasExtra} onChange={(e) => actualizar(j, { horasExtra: e.target.value })} />
              </Campo>
              <Campo label="Importe pagado" error={err(`${hr}.importePagado`)}>
                <InputDinero value={h.importePagado} onChange={(e) => actualizar(j, { importePagado: e.target.value })} />
              </Campo>
              <div className="flex items-end pb-1.5">
                <BotonQuitar onClick={() => onChange(filas.filter((_, k) => k !== j))} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function JubilacionFields({
  valor,
  onChange,
  err,
}: {
  valor: NonNullable<NominaManualForm["jubilacion"]>;
  onChange: (v: NonNullable<NominaManualForm["jubilacion"]>) => void;
  err: (campo: string) => string | null;
}) {
  const setV = (cambio: Partial<typeof valor>) => onChange({ ...valor, ...cambio });
  return (
    <>
      <FieldError mensaje={err("jubilacion")} />
      <Segmented<"UNA_EXHIBICION" | "PARCIALIDAD">
        ariaLabel="Modalidad"
        value={valor.modalidad}
        onChange={(modalidad) => setV({ modalidad })}
        options={[
          { value: "UNA_EXHIBICION", label: "En una exhibición" },
          { value: "PARCIALIDAD", label: "En parcialidades" },
        ]}
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {valor.modalidad === "UNA_EXHIBICION" ? (
          <Campo label="Total en una exhibición" error={err("jubilacion.totalUnaExhibicion")}>
            <InputDinero value={valor.totalUnaExhibicion} onChange={(e) => setV({ totalUnaExhibicion: e.target.value })} />
          </Campo>
        ) : (
          <>
            <Campo label="Total de la parcialidad" error={err("jubilacion.totalParcialidad")}>
              <InputDinero value={valor.totalParcialidad} onChange={(e) => setV({ totalParcialidad: e.target.value })} />
            </Campo>
            <Campo label="Monto diario" error={err("jubilacion.montoDiario")}>
              <InputDinero value={valor.montoDiario} onChange={(e) => setV({ montoDiario: e.target.value })} />
            </Campo>
          </>
        )}
        <Campo label="Ingreso acumulable" error={err("jubilacion.ingresoAcumulable")}>
          <InputDinero value={valor.ingresoAcumulable} onChange={(e) => setV({ ingresoAcumulable: e.target.value })} />
        </Campo>
        <Campo label="Ingreso no acumulable" error={err("jubilacion.ingresoNoAcumulable")}>
          <InputDinero value={valor.ingresoNoAcumulable} onChange={(e) => setV({ ingresoNoAcumulable: e.target.value })} />
        </Campo>
      </div>
    </>
  );
}

function SeparacionFields({
  valor,
  onChange,
  err,
}: {
  valor: NonNullable<NominaManualForm["separacion"]>;
  onChange: (v: NonNullable<NominaManualForm["separacion"]>) => void;
  err: (campo: string) => string | null;
}) {
  const setV = (cambio: Partial<typeof valor>) => onChange({ ...valor, ...cambio });
  return (
    <>
      <FieldError mensaje={err("separacion")} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Campo label="Total pagado" error={err("separacion.totalPagado")}>
          <InputDinero value={valor.totalPagado} onChange={(e) => setV({ totalPagado: e.target.value })} />
        </Campo>
        <Campo label="Años de servicio" error={err("separacion.numAniosServicio")}>
          <InputEntero min="0" max="99" value={valor.numAniosServicio} onChange={(e) => setV({ numAniosServicio: e.target.value })} />
        </Campo>
        <Campo label="Último sueldo mensual ordinario" error={err("separacion.ultimoSueldoMensOrd")}>
          <InputDinero value={valor.ultimoSueldoMensOrd} onChange={(e) => setV({ ultimoSueldoMensOrd: e.target.value })} />
        </Campo>
        <Campo label="Ingreso acumulable" error={err("separacion.ingresoAcumulable")}>
          <InputDinero value={valor.ingresoAcumulable} onChange={(e) => setV({ ingresoAcumulable: e.target.value })} />
        </Campo>
        <Campo label="Ingreso no acumulable" error={err("separacion.ingresoNoAcumulable")}>
          <InputDinero value={valor.ingresoNoAcumulable} onChange={(e) => setV({ ingresoNoAcumulable: e.target.value })} />
        </Campo>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Deducciones                                                                */
/* -------------------------------------------------------------------------- */

function DeduccionesEditor({
  filas,
  catalogo,
  onChange,
  err,
}: {
  filas: DeduccionManual[];
  catalogo: EntradaCatalogoNomina[];
  onChange: (filas: DeduccionManual[]) => void;
  err: (campo: string) => string | null;
}) {
  const total = round2(filas.reduce((a, r) => a + (Number(r.importe) || 0), 0));
  function actualizar(i: number, cambio: Partial<DeduccionManual>) {
    onChange(filas.map((r, j) => (j === i ? { ...r, ...cambio } : r)));
  }
  function cambiarTipo(i: number, tipo: string) {
    const r = filas[i];
    actualizar(i, {
      tipo,
      clave: !r.clave || r.clave === r.tipo ? tipo : r.clave,
      concepto: !r.concepto || r.concepto === textoDe(catalogo, r.tipo) ? textoDe(catalogo, tipo) : r.concepto,
    });
  }
  return (
    <Card>
      <CardHeader
        title="Deducciones"
        description="Lo que se le descuenta. El ISR va con la clave 002; ninguna puede ir en cero."
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-semibold text-ink">{pesos(total)}</span>
            <Button variant="secondary" size="sm" onClick={() => onChange([...filas, nuevaDeduccion()])}>
              Agregar
            </Button>
          </span>
        }
      />
      <CardBody className="space-y-3">
        {filas.length === 0 && (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-3">
            Sin deducciones.
          </p>
        )}
        {filas.map((r, i) => {
          const ref = `deducciones[${i}]`;
          return (
            <div key={r.id} className="grid gap-3 rounded-xl border border-line-2 p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
              <Campo label="Tipo (SAT)" error={err(`${ref}.tipo`)}>
                <SelectCatalogo lista={catalogo} value={r.tipo} onChange={(t) => cambiarTipo(i, t)} />
              </Campo>
              <Campo label="Clave" error={err(`${ref}.clave`)}>
                <Input value={r.clave} maxLength={15} onChange={(e) => actualizar(i, { clave: e.target.value })} />
              </Campo>
              <Campo label="Concepto" error={err(`${ref}.concepto`)}>
                <Input value={r.concepto} maxLength={100} onChange={(e) => actualizar(i, { concepto: e.target.value })} />
              </Campo>
              <Campo label="Importe" error={err(`${ref}.importe`)}>
                <InputDinero value={r.importe} onChange={(e) => actualizar(i, { importe: e.target.value })} />
              </Campo>
              <div className="flex items-end pb-1.5">
                <BotonQuitar onClick={() => onChange(filas.filter((_, j) => j !== i))} />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Otros pagos                                                                */
/* -------------------------------------------------------------------------- */

function OtrosPagosEditor({
  filas,
  catalogo,
  onChange,
  err,
  subsidioAutomatico,
  regimen,
}: {
  filas: OtroPagoManual[];
  catalogo: EntradaCatalogoNomina[];
  onChange: (filas: OtroPagoManual[]) => void;
  err: (campo: string) => string | null;
  subsidioAutomatico: boolean;
  regimen: string;
}) {
  const total = round2(filas.reduce((a, r) => a + (Number(r.importe) || 0), 0));
  function actualizar(i: number, cambio: Partial<OtroPagoManual>) {
    onChange(filas.map((r, j) => (j === i ? { ...r, ...cambio } : r)));
  }
  function cambiarTipo(i: number, tipo: string) {
    const r = filas[i];
    const cambio: Partial<OtroPagoManual> = {
      tipo,
      clave: !r.clave || r.clave === r.tipo ? tipo : r.clave,
      concepto: !r.concepto || r.concepto === textoDe(catalogo, r.tipo) ? textoDe(catalogo, tipo) : r.concepto,
    };
    if (tipo === "002") {
      cambio.subsidioCausado = r.subsidioCausado ?? "0";
      if (!r.importe) cambio.importe = "0";
    } else {
      cambio.subsidioCausado = undefined;
    }
    cambio.compensacion = tipo === "004" ? (r.compensacion ?? { saldoAFavor: "", anio: "", remanenteSalFav: "0" }) : undefined;
    actualizar(i, cambio);
  }
  return (
    <Card>
      <CardHeader
        title="Otros pagos"
        description="Subsidio al empleo, viáticos, compensación de saldos a favor."
        action={
          <span className="flex items-center gap-3">
            <span className="font-mono text-[13px] font-semibold text-ink">{pesos(total)}</span>
            <Button variant="secondary" size="sm" onClick={() => onChange([...filas, nuevoOtroPago()])}>
              Agregar
            </Button>
          </span>
        }
      />
      <CardBody className="space-y-3">
        <FieldError mensaje={err("otrosPagos")} />
        {subsidioAutomatico && (
          <Note tone="info">
            El régimen {regimen} lleva siempre el otro pago 002 (subsidio al empleo). Como no lo capturaste, se
            agregará solo en cero al armar el recibo; si le toca subsidio, agrégalo tú con su importe y su causado.
          </Note>
        )}
        {filas.length === 0 && !subsidioAutomatico && (
          <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-[12.5px] text-ink-3">
            Sin otros pagos.
          </p>
        )}
        {filas.map((r, i) => {
          const ref = `otrosPagos[${i}]`;
          return (
            <div key={r.id} className="rounded-xl border border-line-2 p-3">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)_minmax(0,1fr)_auto]">
                <Campo label="Tipo (SAT)" error={err(`${ref}.tipo`)}>
                  <SelectCatalogo lista={catalogo} value={r.tipo} onChange={(t) => cambiarTipo(i, t)} />
                </Campo>
                <Campo label="Clave" error={err(`${ref}.clave`)}>
                  <Input value={r.clave} maxLength={15} onChange={(e) => actualizar(i, { clave: e.target.value })} />
                </Campo>
                <Campo label="Concepto" error={err(`${ref}.concepto`)}>
                  <Input value={r.concepto} maxLength={100} onChange={(e) => actualizar(i, { concepto: e.target.value })} />
                </Campo>
                <Campo label={r.tipo === "002" ? "Entregado" : "Importe"} error={err(`${ref}.importe`)}>
                  <InputDinero value={r.importe} onChange={(e) => actualizar(i, { importe: e.target.value })} />
                </Campo>
                <div className="flex items-end pb-1.5">
                  <BotonQuitar onClick={() => onChange(filas.filter((_, j) => j !== i))} />
                </div>
              </div>

              {r.tipo === "002" && (
                <div className="mt-3 border-t border-dashed border-line-2 pt-3">
                  <Titulo>Subsidio al empleo</Titulo>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <Campo
                      label="Subsidio causado"
                      hint="Lo que le tocaba por la tabla, aunque no se le entregue. Nunca menor al entregado."
                      error={err(`${ref}.subsidioCausado`)}
                    >
                      <InputDinero value={r.subsidioCausado ?? ""} onChange={(e) => actualizar(i, { subsidioCausado: e.target.value })} />
                    </Campo>
                  </div>
                </div>
              )}

              {r.tipo === "004" && (
                <div className="mt-3 border-t border-dashed border-line-2 pt-3">
                  <Titulo>Compensación de saldos a favor</Titulo>
                  <FieldError mensaje={err(`${ref}.compensacion`)} />
                  <div className="mt-2 grid gap-3 sm:grid-cols-3">
                    <Campo label="Saldo a favor" error={err(`${ref}.compensacion.saldoAFavor`)}>
                      <InputDinero
                        value={r.compensacion?.saldoAFavor ?? ""}
                        onChange={(e) => actualizar(i, { compensacion: { ...(r.compensacion ?? { anio: "", remanenteSalFav: "0" }), saldoAFavor: e.target.value } })}
                      />
                    </Campo>
                    <Campo label="Año" error={err(`${ref}.compensacion.anio`)}>
                      <Select
                        value={r.compensacion?.anio ?? ""}
                        onChange={(e) => actualizar(i, { compensacion: { ...(r.compensacion ?? { saldoAFavor: "", remanenteSalFav: "0" }), anio: e.target.value } })}
                      >
                        <option value="">Selecciona…</option>
                        {aniosRecientes().map((a) => (
                          <option key={a} value={a}>{a}</option>
                        ))}
                      </Select>
                    </Campo>
                    <Campo label="Remanente" error={err(`${ref}.compensacion.remanenteSalFav`)}>
                      <InputDinero
                        value={r.compensacion?.remanenteSalFav ?? ""}
                        onChange={(e) => actualizar(i, { compensacion: { ...(r.compensacion ?? { saldoAFavor: "", anio: "" }), remanenteSalFav: e.target.value } })}
                      />
                    </Campo>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function aniosRecientes(): string[] {
  const actual = new Date().getFullYear();
  return Array.from({ length: 6 }, (_, i) => String(actual - i));
}
