"use client";

import { useState } from "react";
import { Button, Drawer, Note, Pill, Segmented, Td } from "@/components/ui";
import { CatalogoCP, guardarCP, type FormularioCPProps } from "./CatalogoCP";
import { CampoCP, SelectTablaSat, TextoCP } from "./CamposCP";
import { useTablaSat } from "@/lib/useTablaSat";
import {
  MEDIOS_CP,
  aereoVacio,
  autotransporteVacio,
  ferroviarioVacio,
  maritimoVacio,
  nombreMedio,
  validarTransporte,
  type Aereo,
  type Autotransporte,
  type ErroresCP,
  type Ferroviario,
  type Maritimo,
  type MedioCP,
  type PaginaCP,
  type TransporteCP,
} from "@/lib/cartaPorteShared";

const TONO_MEDIO: Record<string, "teal" | "info" | "violet" | "brand"> = { "01": "teal", "02": "info", "03": "violet", "04": "brand" };

function resumen(t: TransporteCP) {
  if (t.autotransporte) {
    const a = t.autotransporte;
    return { config: `${a.configvehicular}${a.remolques.length ? ` · ${a.remolques.length} remolque${a.remolques.length > 1 ? "s" : ""}` : ""}`, placa: a.placavm, seguro: a.asegurarespcivil };
  }
  if (t.maritimo) return { config: t.maritimo.tipoembarcacion, placa: t.maritimo.matricula, seguro: t.nombreaseg };
  if (t.aereo) return { config: t.aereo.codigotransportista, placa: t.aereo.matriculaaeronave, seguro: t.nombreaseg };
  if (t.ferroviario) return { config: `${t.ferroviario.tipodeservicio} · ${t.ferroviario.carros.length} carro${t.ferroviario.carros.length === 1 ? "" : "s"}`, placa: "", seguro: t.nombreaseg };
  return { config: "", placa: "", seguro: "" };
}

export function TransportesSection({ rfc, inicial }: { rfc: string; inicial: PaginaCP<TransporteCP> }) {
  return (
    <CatalogoCP<TransporteCP>
      rfc={rfc}
      entidad="transporte"
      inicial={inicial}
      titulo="Transportes"
      descripcion="Tus unidades por medio: autotransporte, marítimo, aéreo y ferroviario."
      nuevo="Nuevo transporte"
      vacio={{ titulo: "Sin transportes todavía", descripcion: "Registra tus camiones con su permiso SCT, placas y seguro una sola vez." }}
      encabezados={["Unidad", "Medio", "Configuración", "Placa o matrícula", "Seguro"]}
      nombreDe={(t) => t.alias || "Transporte"}
      fila={(t) => {
        const r = resumen(t);
        return (
          <>
            <Td className="font-semibold text-ink">{t.alias || "Sin nombre"}</Td>
            <Td>
              <Pill tone={TONO_MEDIO[t.tipotransporte] ?? "neutral"}>{nombreMedio(t.tipotransporte)}</Pill>
            </Td>
            <Td className="text-[12.5px]">{r.config}</Td>
            <Td className="font-mono text-[12.5px]">{r.placa}</Td>
            <Td className="text-[12.5px] text-ink-2">{r.seguro}</Td>
          </>
        );
      }}
      Formulario={TransportePanel}
    />
  );
}

function clonar<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

export function TransportePanel({ rfc, inicial, onCerrar, onGuardado }: FormularioCPProps<TransporteCP>) {
  const [t, setT] = useState<TransporteCP>(() =>
    inicial
      ? clonar(inicial)
      : {
          idlocal: "",
          alias: "",
          tipotransporte: "01",
          permsct: "",
          numpermisosct: "",
          nombreaseg: "",
          numpolizaseguro: "",
          autotransporte: autotransporteVacio(),
          maritimo: null,
          aereo: null,
          ferroviario: null,
        }
  );
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const configs = useTablaSat("SAT_CCP_CONFIGURACIONES_AUTOTRANSPORTE");

  const configActual = configs.find((c) => c.id === t.autotransporte?.configvehicular);
  const pideRemolque = configActual?.remolque === "1";
  const errores = validarTransporte(t, pideRemolque);
  const set = (c: Partial<TransporteCP>) => setT((prev) => ({ ...prev, ...c }));

  function cambiarMedio(medio: MedioCP) {
    // Se conserva lo capturado en cada medio mientras el panel siga abierto:
    // cambiar de pestaña por error no borra nada. Al guardar solo viaja el del medio elegido.
    setT((prev) => ({
      ...prev,
      tipotransporte: medio,
      permsct: prev.tipotransporte === medio ? prev.permsct : "",
      autotransporte: prev.autotransporte ?? (medio === "01" ? autotransporteVacio() : null),
      maritimo: prev.maritimo ?? (medio === "02" ? maritimoVacio() : null),
      aereo: prev.aereo ?? (medio === "03" ? aereoVacio() : null),
      ferroviario: prev.ferroviario ?? (medio === "04" ? ferroviarioVacio() : null),
    }));
  }

  async function guardar() {
    setIntentado(true);
    setError(null);
    if (Object.keys(errores).length > 0) {
      setError("Revisa los campos marcados.");
      return;
    }
    setGuardando(true);
    const medio = t.tipotransporte;
    const r = await guardarCP(rfc, "transporte", {
      ...t,
      autotransporte: medio === "01" && t.autotransporte
        ? { ...t.autotransporte, placavm: t.autotransporte.placavm.toUpperCase(), remolques: t.autotransporte.remolques.map((x) => ({ ...x, placa: x.placa.toUpperCase() })) }
        : null,
      maritimo: medio === "02" ? t.maritimo : null,
      aereo: medio === "03" ? t.aereo : null,
      ferroviario: medio === "04" ? t.ferroviario : null,
    });
    setGuardando(false);
    if (r.ok) onGuardado(r.registro);
    else setError(r.error);
  }

  const comun = { errores, mostrar: intentado };

  return (
    <Drawer
      title={t.alias || (inicial ? "Transporte" : "Nuevo transporte")}
      subtitle={inicial ? "Editar transporte" : "Nuevo transporte"}
      onClose={onCerrar}
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar transporte"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Note tone="danger">{error}</Note>}
        <CampoCP label="Nombre para reconocerlo" nombre="alias" {...comun} hint="Solo para ti: “Kenworth T680 2021”, “Buque Mar de Cortés”">
          <TextoCP value={t.alias} onChange={(v) => set({ alias: v })} invalid={intentado && !!errores.alias} />
        </CampoCP>
        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">Medio de transporte</p>
          <Segmented
            ariaLabel="Medio de transporte"
            value={t.tipotransporte || "01"}
            onChange={(v) => cambiarMedio(v as MedioCP)}
            options={MEDIOS_CP.map((m) => ({ value: m.id, label: m.nombre }))}
          />
        </div>

        {(t.tipotransporte === "01" || t.tipotransporte === "03") && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoCP label="Tipo de permiso SCT" nombre="permsct" {...comun} className="sm:col-span-2">
              <SelectTablaSat
                tabla="SAT_CCP_TIPOS_PERMISO"
                value={t.permsct}
                filtrar={(f) => f.clave_transporte === t.tipotransporte}
                invalid={intentado && !!errores.permsct}
                onChange={(id) => set({ permsct: id })}
              />
            </CampoCP>
            <CampoCP label="Número de permiso" nombre="numpermisosct" {...comun} className="sm:col-span-2">
              <TextoCP value={t.numpermisosct} onChange={(v) => set({ numpermisosct: v })} mono invalid={intentado && !!errores.numpermisosct} />
            </CampoCP>
          </div>
        )}

        {t.tipotransporte === "01" && t.autotransporte && (
          <Autotransporte a={t.autotransporte} onChange={(a) => set({ autotransporte: a })} pideRemolque={pideRemolque} {...comun} />
        )}
        {t.tipotransporte === "02" && t.maritimo && (
          <MaritimoCampos m={t.maritimo} t={t} onChange={(m) => set({ maritimo: m })} onT={set} {...comun} />
        )}
        {t.tipotransporte === "03" && t.aereo && (
          <AereoCampos a={t.aereo} t={t} onChange={(a) => set({ aereo: a })} onT={set} {...comun} />
        )}
        {t.tipotransporte === "04" && t.ferroviario && (
          <FerroviarioCampos f={t.ferroviario} t={t} onChange={(f) => set({ ferroviario: f })} onT={set} {...comun} />
        )}
      </div>
    </Drawer>
  );
}

type Comun = { errores: ErroresCP; mostrar: boolean };

function Subtitulo({ children, accion }: { children: React.ReactNode; accion?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 pt-1">
      <p className="text-[13px] font-semibold text-ink">{children}</p>
      {accion}
    </div>
  );
}

function Quitar({ onClick }: { onClick: () => void }) {
  return (
    <Button size="sm" variant="ghost" onClick={onClick}>
      Quitar
    </Button>
  );
}

function Autotransporte({ a, onChange, pideRemolque, errores, mostrar }: { a: Autotransporte; onChange: (a: Autotransporte) => void; pideRemolque: boolean } & Comun) {
  const set = (c: Partial<Autotransporte>) => onChange({ ...a, ...c });
  const comun = { errores, mostrar };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoCP label="Configuración vehicular" nombre="configvehicular" {...comun} className="sm:col-span-2">
          <SelectTablaSat
            tabla="SAT_CCP_CONFIGURACIONES_AUTOTRANSPORTE"
            value={a.configvehicular}
            invalid={mostrar && !!errores.configvehicular}
            onChange={(id) => set({ configvehicular: id })}
          />
        </CampoCP>
        <CampoCP label="Placa" nombre="placavm" {...comun} hint="Sin guiones ni espacios">
          <TextoCP value={a.placavm} onChange={(v) => set({ placavm: v.replace(/[\s-]/g, "") })} mayusculas mono maxLength={7} invalid={mostrar && !!errores.placavm} />
        </CampoCP>
        <CampoCP label="Año del modelo" nombre="aniomodelovm" {...comun}>
          <TextoCP value={a.aniomodelovm} onChange={(v) => set({ aniomodelovm: v })} inputMode="numeric" maxLength={4} mono invalid={mostrar && !!errores.aniomodelovm} />
        </CampoCP>
        <CampoCP label="Peso bruto vehicular (toneladas)" nombre="Pesobrutovehicular" {...comun}>
          <TextoCP value={a.Pesobrutovehicular} onChange={(v) => set({ Pesobrutovehicular: v })} inputMode="decimal" mono invalid={mostrar && !!errores.Pesobrutovehicular} />
        </CampoCP>
      </div>
      <Subtitulo>Seguros</Subtitulo>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoCP label="Aseguradora de responsabilidad civil" nombre="asegurarespcivil" {...comun}>
          <TextoCP value={a.asegurarespcivil} onChange={(v) => set({ asegurarespcivil: v })} invalid={mostrar && !!errores.asegurarespcivil} />
        </CampoCP>
        <CampoCP label="Póliza de responsabilidad civil" nombre="polizarespcivil" {...comun}>
          <TextoCP value={a.polizarespcivil} onChange={(v) => set({ polizarespcivil: v })} mono invalid={mostrar && !!errores.polizarespcivil} />
        </CampoCP>
        <CampoCP label="Aseguradora de medio ambiente" nombre="aseguramedambiente" {...comun} hint="Solo si llevas material peligroso">
          <TextoCP value={a.aseguramedambiente} onChange={(v) => set({ aseguramedambiente: v })} />
        </CampoCP>
        <CampoCP label="Póliza de medio ambiente" nombre="polizamedambiente" {...comun}>
          <TextoCP value={a.polizamedambiente} onChange={(v) => set({ polizamedambiente: v })} mono />
        </CampoCP>
        <CampoCP label="Aseguradora de la carga" nombre="aseguracarga" {...comun}>
          <TextoCP value={a.aseguracarga} onChange={(v) => set({ aseguracarga: v })} />
        </CampoCP>
        <CampoCP label="Póliza de la carga" nombre="polizacarga" {...comun}>
          <TextoCP value={a.polizacarga} onChange={(v) => set({ polizacarga: v })} mono />
        </CampoCP>
        <CampoCP label="Prima del seguro" nombre="primaseguro" {...comun}>
          <TextoCP value={a.primaseguro} onChange={(v) => set({ primaseguro: v })} inputMode="decimal" mono invalid={mostrar && !!errores.primaseguro} />
        </CampoCP>
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
        <Subtitulo
          accion={
            a.remolques.length < 2 ? (
              <Button size="sm" variant="ghost" onClick={() => set({ remolques: [...a.remolques, { subtiporem: "", placa: "" }] })}>
                Agregar remolque
              </Button>
            ) : undefined
          }
        >
          Remolques {pideRemolque && <Pill tone="warn">Esta configuración pide al menos 1</Pill>}
        </Subtitulo>
        {a.remolques.length === 0 && <p className="text-[12.5px] text-ink-3">Sin remolques.</p>}
        {a.remolques.map((r, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_130px_auto] items-start gap-2">
            <CampoCP label="Tipo" nombre={`remolques.${i}.subtiporem`} {...comun}>
              <SelectTablaSat
                tabla="SAT_CCP_TIPOS_REMOLQUE"
                value={r.subtiporem}
                onChange={(id) => set({ remolques: a.remolques.map((x, j) => (j === i ? { ...x, subtiporem: id } : x)) })}
              />
            </CampoCP>
            <CampoCP label="Placa" nombre={`remolques.${i}.placa`} {...comun}>
              <TextoCP
                value={r.placa}
                mayusculas
                mono
                maxLength={7}
                onChange={(v) => set({ remolques: a.remolques.map((x, j) => (j === i ? { ...x, placa: v.replace(/[\s-]/g, "") } : x)) })}
              />
            </CampoCP>
            <div className="pt-6">
              <Quitar onClick={() => set({ remolques: a.remolques.filter((_, j) => j !== i) })} />
            </div>
          </div>
        ))}
        {mostrar && errores.remolques && <p className="text-[12px] text-danger">{errores.remolques}</p>}
      </div>
    </div>
  );
}

function SeguroGeneral({ t, onT, errores, mostrar }: { t: TransporteCP; onT: (c: Partial<TransporteCP>) => void } & Comun) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <CampoCP label="Aseguradora" nombre="nombreaseg" errores={errores} mostrar={mostrar}>
        <TextoCP value={t.nombreaseg} onChange={(v) => onT({ nombreaseg: v })} invalid={mostrar && !!errores.nombreaseg} />
      </CampoCP>
      <CampoCP label="Póliza" nombre="numpolizaseguro" errores={errores} mostrar={mostrar}>
        <TextoCP value={t.numpolizaseguro} onChange={(v) => onT({ numpolizaseguro: v })} mono />
      </CampoCP>
    </div>
  );
}

function MaritimoCampos({ m, t, onChange, onT, errores, mostrar }: { m: Maritimo; t: TransporteCP; onChange: (m: Maritimo) => void; onT: (c: Partial<TransporteCP>) => void } & Comun) {
  const set = (c: Partial<Maritimo>) => onChange({ ...m, ...c });
  const comun = { errores, mostrar };
  const texto = (campo: keyof Maritimo, etiqueta: string, extra?: { mono?: boolean; hint?: string; num?: boolean }) => (
    <CampoCP key={campo} label={etiqueta} nombre={campo} {...comun} hint={extra?.hint}>
      <TextoCP
        value={m[campo] as string}
        onChange={(v) => set({ [campo]: v } as Partial<Maritimo>)}
        mono={extra?.mono}
        inputMode={extra?.num ? "decimal" : undefined}
        invalid={mostrar && !!errores[campo]}
      />
    </CampoCP>
  );
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoCP label="Tipo de embarcación" nombre="tipoembarcacion" {...comun}>
          <SelectTablaSat tabla="SAT_CCP_CONFIGURACIONES_MARITIMAS" value={m.tipoembarcacion} invalid={mostrar && !!errores.tipoembarcacion} onChange={(id) => set({ tipoembarcacion: id })} />
        </CampoCP>
        <CampoCP label="Nacionalidad" nombre="nacionalidadembarc" {...comun}>
          <SelectTablaSat tabla="SAT_GEO_PAISES" value={m.nacionalidadembarc} invalid={mostrar && !!errores.nacionalidadembarc} onChange={(id) => set({ nacionalidadembarc: id })} />
        </CampoCP>
        {texto("matricula", "Matrícula", { mono: true })}
        {texto("numeroomi", "Número OMI", { mono: true, hint: "IMO seguido de 7 dígitos" })}
        {texto("nombreembarc", "Nombre de la embarcación")}
        {texto("unidadesdearqbruto", "Unidades de arqueo bruto", { num: true, mono: true })}
        {texto("numcertitc", "Certificado ITC", { mono: true })}
        {texto("numconocembarc", "Conocimiento de embarque", { mono: true })}
        {texto("eslora", "Eslora (m)", { num: true, mono: true })}
        {texto("manga", "Manga (m)", { num: true, mono: true })}
        {texto("calado", "Calado (m)", { num: true, mono: true })}
        {texto("Puntal", "Puntal (m)", { num: true, mono: true })}
        {texto("lineanaviera", "Línea naviera")}
        {texto("nombreagentenaviero", "Agente naviero consignatario")}
        <CampoCP label="Autorización del naviero" nombre="numautorizacionnaviero" {...comun}>
          <SelectTablaSat tabla="SAT_CCP_AUTORIZACIONES_NAVIERO" value={m.numautorizacionnaviero} invalid={mostrar && !!errores.numautorizacionnaviero} onChange={(id) => set({ numautorizacionnaviero: id })} />
        </CampoCP>
        {texto("Permisotempnavegacion", "Permiso temporal de navegación", { mono: true })}
      </div>
      <Subtitulo>Seguro</Subtitulo>
      <SeguroGeneral t={t} onT={onT} {...comun} />
      <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
        <Subtitulo
          accion={
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set({ contenedores: [...m.contenedores, { matriculacontenedor: "", tipocontenedor: "", numprecinto: "", IdCCPRelacionado: "", PlacaVMCCP: "", FechaCertificacionCCP: "", remolques: [] }] })
              }
            >
              Agregar contenedor
            </Button>
          }
        >
          Contenedores
        </Subtitulo>
        {m.contenedores.length === 0 && <p className="text-[12.5px] text-ink-3">Sin contenedores.</p>}
        {m.contenedores.map((c, i) => {
          const setC = (cambios: Partial<typeof c>) => set({ contenedores: m.contenedores.map((x, j) => (j === i ? { ...x, ...cambios } : x)) });
          return (
            <div key={i} className="space-y-2 rounded-lg border border-line bg-surface p-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CampoCP label="Matrícula" nombre={`c${i}`} {...comun}>
                  <TextoCP value={c.matriculacontenedor} onChange={(v) => setC({ matriculacontenedor: v })} mono mayusculas />
                </CampoCP>
                <CampoCP label="Tipo" nombre={`ct${i}`} {...comun}>
                  <SelectTablaSat tabla="SAT_CCP_CONTENEDORES_MARITIMOS" value={c.tipocontenedor} onChange={(id) => setC({ tipocontenedor: id })} />
                </CampoCP>
                <CampoCP label="Precinto" nombre={`cp${i}`} {...comun}>
                  <TextoCP value={c.numprecinto} onChange={(v) => setC({ numprecinto: v })} mono />
                </CampoCP>
                <CampoCP label="IdCCP relacionado" nombre={`ci${i}`} {...comun}>
                  <TextoCP value={c.IdCCPRelacionado} onChange={(v) => setC({ IdCCPRelacionado: v })} mono />
                </CampoCP>
                <CampoCP label="Placa del vehículo" nombre={`cv${i}`} {...comun}>
                  <TextoCP value={c.PlacaVMCCP} onChange={(v) => setC({ PlacaVMCCP: v })} mono mayusculas />
                </CampoCP>
                <CampoCP label="Fecha de certificación" nombre={`cf${i}`} {...comun}>
                  <TextoCP value={c.FechaCertificacionCCP} onChange={(v) => setC({ FechaCertificacionCCP: v })} type="date" />
                </CampoCP>
              </div>
              {c.remolques.map((r, k) => (
                <div key={k} className="grid grid-cols-[minmax(0,1fr)_130px_auto] items-end gap-2">
                  <CampoCP label="Remolque" nombre={`cr${i}.${k}`} {...comun}>
                    <SelectTablaSat
                      tabla="SAT_CCP_TIPOS_REMOLQUE"
                      value={r.SubTipoRemCCP}
                      onChange={(id) => setC({ remolques: c.remolques.map((x, j) => (j === k ? { ...x, SubTipoRemCCP: id } : x)) })}
                    />
                  </CampoCP>
                  <CampoCP label="Placa" nombre={`crp${i}.${k}`} {...comun}>
                    <TextoCP value={r.PlacaCCP} mono mayusculas onChange={(v) => setC({ remolques: c.remolques.map((x, j) => (j === k ? { ...x, PlacaCCP: v } : x)) })} />
                  </CampoCP>
                  <Quitar onClick={() => setC({ remolques: c.remolques.filter((_, j) => j !== k) })} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setC({ remolques: [...c.remolques, { SubTipoRemCCP: "", PlacaCCP: "" }] })}>
                  Agregar remolque
                </Button>
                <Quitar onClick={() => set({ contenedores: m.contenedores.filter((_, j) => j !== i) })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AereoCampos({ a, t, onChange, onT, errores, mostrar }: { a: Aereo; t: TransporteCP; onChange: (a: Aereo) => void; onT: (c: Partial<TransporteCP>) => void } & Comun) {
  const set = (c: Partial<Aereo>) => onChange({ ...a, ...c });
  const comun = { errores, mostrar };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoCP label="Matrícula de la aeronave" nombre="matriculaaeronave" {...comun}>
          <TextoCP value={a.matriculaaeronave} onChange={(v) => set({ matriculaaeronave: v })} mono mayusculas />
        </CampoCP>
        <CampoCP label="Número de guía" nombre="numeroguia" {...comun}>
          <TextoCP value={a.numeroguia} onChange={(v) => set({ numeroguia: v })} mono invalid={mostrar && !!errores.numeroguia} />
        </CampoCP>
        <CampoCP label="Transportista" nombre="codigotransportista" {...comun} className="sm:col-span-2">
          <SelectTablaSat tabla="SAT_CCP_CODIGOS_TRANSPORTE_AEREO" value={a.codigotransportista} invalid={mostrar && !!errores.codigotransportista} onChange={(id) => set({ codigotransportista: id })} />
        </CampoCP>
        <CampoCP label="Nombre del embarcador" nombre="nombreembarcador" {...comun}>
          <TextoCP value={a.nombreembarcador} onChange={(v) => set({ nombreembarcador: v })} />
        </CampoCP>
        <CampoCP label="RFC del embarcador" nombre="rfcembarcador" {...comun}>
          <TextoCP value={a.rfcembarcador} onChange={(v) => set({ rfcembarcador: v })} mono mayusculas maxLength={13} invalid={mostrar && !!errores.rfcembarcador} />
        </CampoCP>
        <CampoCP label="Residencia fiscal del embarcador" nombre="residenciafiscalembarc" {...comun} hint="Solo si es extranjero">
          <SelectTablaSat tabla="SAT_GEO_PAISES" value={a.residenciafiscalembarc} placeholder="México" onChange={(id) => set({ residenciafiscalembarc: id === "MEX" ? "" : id })} />
        </CampoCP>
        <CampoCP label="Registro tributario del embarcador" nombre="numregidtribembarc" {...comun}>
          <TextoCP value={a.numregidtribembarc} onChange={(v) => set({ numregidtribembarc: v })} mono />
        </CampoCP>
        <CampoCP label="Certificado de aeronavegabilidad" nombre="numcertitc" {...comun}>
          <TextoCP value={a.numcertitc} onChange={(v) => set({ numcertitc: v })} mono />
        </CampoCP>
      </div>
      <Subtitulo>Seguro</Subtitulo>
      <SeguroGeneral t={t} onT={onT} {...comun} />
    </div>
  );
}

function FerroviarioCampos({ f, t, onChange, onT, errores, mostrar }: { f: Ferroviario; t: TransporteCP; onChange: (f: Ferroviario) => void; onT: (c: Partial<TransporteCP>) => void } & Comun) {
  const set = (c: Partial<Ferroviario>) => onChange({ ...f, ...c });
  const comun = { errores, mostrar };
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CampoCP label="Tipo de servicio" nombre="tipodeservicio" {...comun}>
          <SelectTablaSat tabla="SAT_CCP_TIPOS_SERVICIO" value={f.tipodeservicio} invalid={mostrar && !!errores.tipodeservicio} onChange={(id) => set({ tipodeservicio: id })} />
        </CampoCP>
        <CampoCP label="Tipo de tráfico" nombre="tipodetrafico" {...comun}>
          <SelectTablaSat tabla="SAT_CCP_TIPOS_TRAFICO" value={f.tipodetrafico} invalid={mostrar && !!errores.tipodetrafico} onChange={(id) => set({ tipodetrafico: id })} />
        </CampoCP>
      </div>
      <Subtitulo>Seguro</Subtitulo>
      <SeguroGeneral t={t} onT={onT} {...comun} />
      <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
        <Subtitulo
          accion={
            <Button size="sm" variant="ghost" onClick={() => set({ derechosPaso: [...f.derechosPaso, { tipoderechodepaso: "", kilometrajepagado: "" }] })}>
              Agregar derecho de paso
            </Button>
          }
        >
          Derechos de paso
        </Subtitulo>
        {f.derechosPaso.length === 0 && <p className="text-[12.5px] text-ink-3">Sin derechos de paso.</p>}
        {f.derechosPaso.map((d, i) => (
          <div key={i} className="grid grid-cols-[minmax(0,1fr)_130px_auto] items-end gap-2">
            <CampoCP label="Derecho de paso" nombre={`d${i}`} {...comun}>
              <SelectTablaSat
                tabla="SAT_CCP_DERECHOS_DE_PASO"
                value={d.tipoderechodepaso}
                onChange={(id) => set({ derechosPaso: f.derechosPaso.map((x, j) => (j === i ? { ...x, tipoderechodepaso: id } : x)) })}
              />
            </CampoCP>
            <CampoCP label="Km pagados" nombre={`dk${i}`} {...comun}>
              <TextoCP value={d.kilometrajepagado} mono inputMode="decimal" onChange={(v) => set({ derechosPaso: f.derechosPaso.map((x, j) => (j === i ? { ...x, kilometrajepagado: v } : x)) })} />
            </CampoCP>
            <Quitar onClick={() => set({ derechosPaso: f.derechosPaso.filter((_, j) => j !== i) })} />
          </div>
        ))}
      </div>
      <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
        <Subtitulo
          accion={
            <Button size="sm" variant="ghost" onClick={() => set({ carros: [...f.carros, { tipocarro: "", matriculacarro: "", guiacarro: "", contenedores: [] }] })}>
              Agregar carro
            </Button>
          }
        >
          Carros
        </Subtitulo>
        {f.carros.length === 0 && <p className="text-[12.5px] text-ink-3">Sin carros.</p>}
        {mostrar && errores.carros && <p className="text-[12px] text-danger">{errores.carros}</p>}
        {f.carros.map((c, i) => {
          const setC = (cambios: Partial<typeof c>) => set({ carros: f.carros.map((x, j) => (j === i ? { ...x, ...cambios } : x)) });
          return (
            <div key={i} className="space-y-2 rounded-lg border border-line bg-surface p-2.5">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <CampoCP label="Tipo de carro" nombre={`carros.${i}.tipocarro`} {...comun}>
                  <SelectTablaSat tabla="SAT_CCP_TIPOS_CARRO" value={c.tipocarro} onChange={(id) => setC({ tipocarro: id })} />
                </CampoCP>
                <CampoCP label="Matrícula" nombre={`carros.${i}.matriculacarro`} {...comun}>
                  <TextoCP value={c.matriculacarro} onChange={(v) => setC({ matriculacarro: v })} mono mayusculas />
                </CampoCP>
                <CampoCP label="Guía" nombre={`carros.${i}.guiacarro`} {...comun}>
                  <TextoCP value={c.guiacarro} onChange={(v) => setC({ guiacarro: v })} mono />
                </CampoCP>
              </div>
              {c.contenedores.map((k, n) => (
                <div key={n} className="grid grid-cols-[minmax(0,1fr)_150px_auto] items-end gap-2">
                  <CampoCP label="Contenedor" nombre={`cc${i}.${n}`} {...comun}>
                    <SelectTablaSat
                      tabla="SAT_CCP_CONTENEDORES"
                      value={k.tipocontenedor}
                      onChange={(id) => setC({ contenedores: c.contenedores.map((x, j) => (j === n ? { ...x, tipocontenedor: id } : x)) })}
                    />
                  </CampoCP>
                  <CampoCP label="Peso vacío (t)" nombre={`ccp${i}.${n}`} {...comun}>
                    <TextoCP value={k.pesocontenedorvacio} mono inputMode="decimal" onChange={(v) => setC({ contenedores: c.contenedores.map((x, j) => (j === n ? { ...x, pesocontenedorvacio: v } : x)) })} />
                  </CampoCP>
                  <Quitar onClick={() => setC({ contenedores: c.contenedores.filter((_, j) => j !== n) })} />
                </div>
              ))}
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setC({ contenedores: [...c.contenedores, { tipocontenedor: "", pesocontenedorvacio: "" }] })}>
                  Agregar contenedor
                </Button>
                <Quitar onClick={() => set({ carros: f.carros.filter((_, j) => j !== i) })} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
