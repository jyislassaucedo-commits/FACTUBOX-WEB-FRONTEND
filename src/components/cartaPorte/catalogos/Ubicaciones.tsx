"use client";

import { useState } from "react";
import { Button, Modal, Note, Pill, Segmented, Td } from "@/components/ui";
import { CatalogoCP, guardarCP, type FormularioCPProps } from "./CatalogoCP";
import { BuscadorTablaSat, CampoCP, DomicilioCP, SelectTablaSat, TextoCP } from "./CamposCP";
import { MEDIOS_CP, nombreMedio, ubicacionVacia, validarUbicacion, type PaginaCP, type UbicacionCP } from "@/lib/cartaPorteShared";

export function UbicacionesSection({ rfc, inicial }: { rfc: string; inicial: PaginaCP<UbicacionCP> }) {
  return (
    <CatalogoCP<UbicacionCP>
      rfc={rfc}
      entidad="ubicacion"
      inicial={inicial}
      titulo="Ubicaciones"
      descripcion="Orígenes y destinos que repites: bodegas, plantas, clientes."
      nuevo="Nueva ubicación"
      vacio={{ titulo: "Sin ubicaciones todavía", descripcion: "Guarda tus orígenes y destinos para armar cada ruta en segundos." }}
      encabezados={["Nombre", "Remitente / destinatario", "Domicilio", "Medio"]}
      nombreDe={(u) => u.nombreremdest}
      fila={(u) => (
        <>
          <Td className="font-semibold text-ink">{u.nombreremdest}</Td>
          <Td className="font-mono text-[12.5px]">{u.rfcremdest || u.numregidtrib}</Td>
          <Td className="text-[12.5px] text-ink-2">
            {[u.calle && `${u.calle} ${u.numeroexterior}`.trim(), u.estado, u.pais !== "MEX" ? u.pais : null].filter(Boolean).join(", ")}
            <span className="ml-1 font-mono text-ink-3">{u.codigopostal}</span>
          </Td>
          <Td>
            <Pill tone="neutral">{u.tipotransporte && u.tipotransporte !== "01" ? `${nombreMedio(u.tipotransporte)} · ${u.numestacion}` : "Autotransporte"}</Pill>
          </Td>
        </>
      )}
      Formulario={UbicacionForm}
    />
  );
}

function UbicacionForm({ rfc, inicial, onCerrar, onGuardado }: FormularioCPProps<UbicacionCP>) {
  const [u, setU] = useState<UbicacionCP>(() => (inicial ? { ...inicial } : ubicacionVacia()));
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const errores = validarUbicacion(u);
  const set = (c: Partial<UbicacionCP>) => setU((prev) => ({ ...prev, ...c }));
  const extranjero = !!u.residenciafiscal && u.residenciafiscal !== "MEX";
  const conEstacion = !!u.tipotransporte && u.tipotransporte !== "01";

  async function guardar() {
    setIntentado(true);
    setError(null);
    if (Object.keys(errores).length > 0) return;
    setGuardando(true);
    const r = await guardarCP(rfc, "ubicacion", {
      ...u,
      rfcremdest: u.rfcremdest.trim().toUpperCase(),
      ...(conEstacion ? {} : { numestacion: "", nombreestacion: "", navegaciontrafico: "", tipoestacion: "" }),
    });
    setGuardando(false);
    if (r.ok) onGuardado(r.registro);
    else setError(r.error);
  }

  return (
    <Modal
      title={inicial ? "Editar ubicación" : "Nueva ubicación"}
      onClose={onCerrar}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar ubicación"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Note tone="danger">{error}</Note>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoCP label="Nombre" nombre="nombreremdest" errores={errores} mostrar={intentado} className="sm:col-span-2" hint="Del remitente o destinatario, como aparece en la carta porte">
            <TextoCP value={u.nombreremdest} onChange={(v) => set({ nombreremdest: v })} invalid={intentado && !!errores.nombreremdest} />
          </CampoCP>
          <CampoCP label="Residencia fiscal" nombre="residenciafiscal" errores={errores} mostrar={intentado} hint="Solo si es extranjero">
            <SelectTablaSat tabla="SAT_GEO_PAISES" value={u.residenciafiscal} placeholder="México" onChange={(id) => set({ residenciafiscal: id === "MEX" ? "" : id })} />
          </CampoCP>
          {extranjero ? (
            <CampoCP label="Registro de identidad tributaria" nombre="numregidtrib" errores={errores} mostrar={intentado}>
              <TextoCP value={u.numregidtrib} onChange={(v) => set({ numregidtrib: v })} mono invalid={intentado && !!errores.numregidtrib} />
            </CampoCP>
          ) : (
            <CampoCP label="RFC" nombre="rfcremdest" errores={errores} mostrar={intentado}>
              <TextoCP value={u.rfcremdest} onChange={(v) => set({ rfcremdest: v })} mayusculas mono maxLength={13} invalid={intentado && !!errores.rfcremdest} />
            </CampoCP>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">¿Por qué medio llega o sale?</p>
          <Segmented
            ariaLabel="Medio de transporte"
            value={u.tipotransporte || "01"}
            onChange={(v) => set({ tipotransporte: v, numestacion: "", nombreestacion: "", tipoestacion: "" })}
            options={MEDIOS_CP.map((m) => ({ value: m.id, label: m.nombre }))}
          />
        </div>

        {conEstacion && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoCP label="Estación" nombre="numestacion" errores={errores} mostrar={intentado}>
              <BuscadorTablaSat
                tabla="SAT_CCP_ESTACIONES"
                medio={u.tipotransporte}
                value={u.numestacion}
                texto={u.nombreestacion}
                placeholder="Clave o nombre de la estación"
                invalid={intentado && !!errores.numestacion}
                onChange={(id, fila) => set({ numestacion: id, nombreestacion: fila?.texto ?? u.nombreestacion })}
              />
            </CampoCP>
            <CampoCP label="Tipo de estación" nombre="tipoestacion" errores={errores} mostrar={intentado}>
              <SelectTablaSat
                tabla="SAT_CCP_TIPOS_ESTACION"
                value={u.tipoestacion}
                filtrar={(f) => !f.claves_transportes || f.claves_transportes.split(",").includes(u.tipotransporte)}
                onChange={(id) => set({ tipoestacion: id })}
              />
            </CampoCP>
            {u.tipotransporte === "02" && (
              <CampoCP label="Navegación" nombre="navegaciontrafico" errores={errores} mostrar={intentado}>
                <Segmented
                  ariaLabel="Tipo de navegación"
                  value={u.navegaciontrafico || "Altura"}
                  onChange={(v) => set({ navegaciontrafico: v })}
                  options={[
                    { value: "Altura", label: "Altura" },
                    { value: "Cabotaje", label: "Cabotaje" },
                  ]}
                />
              </CampoCP>
            )}
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-semibold text-ink-2">Domicilio</p>
          <DomicilioCP valor={u} onChange={set} errores={errores} mostrar={intentado} />
        </div>
      </div>
    </Modal>
  );
}
