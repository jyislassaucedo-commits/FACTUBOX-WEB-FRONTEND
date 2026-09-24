"use client";

import { useState } from "react";
import { Button, Modal, Note, Pill, Td } from "@/components/ui";
import { CatalogoCP, guardarCP, type FormularioCPProps } from "./CatalogoCP";
import { CampoCP, DomicilioCP, SelectTablaSat, TextoCP } from "./CamposCP";
import { useTablaSat } from "@/lib/useTablaSat";
import { figuraVacia, validarFigura, type FiguraCP, type PaginaCP } from "@/lib/cartaPorteShared";

const TONO_FIGURA: Record<string, "brand" | "info" | "teal" | "violet"> = {
  "01": "brand",
  "02": "info",
  "03": "teal",
  "04": "violet",
};

export function FigurasSection({ rfc, inicial }: { rfc: string; inicial: PaginaCP<FiguraCP> }) {
  const figuras = useTablaSat("SAT_CCP_FIGURAS_TRANSPORTE");
  const nombreFigura = (id: string) => figuras.find((f) => f.id === id)?.texto ?? id;
  return (
    <CatalogoCP<FiguraCP>
      rfc={rfc}
      entidad="figura"
      inicial={inicial}
      titulo="Figuras de transporte"
      descripcion="Operadores, propietarios y arrendadores que aparecen en tus cartas porte."
      nuevo="Nueva figura"
      vacio={{ titulo: "Sin figuras todavía", descripcion: "Agrega a tus operadores con su licencia para elegirlos en cada viaje." }}
      encabezados={["Nombre", "Figura", "RFC", "Licencia o partes"]}
      nombreDe={(f) => f.nombre}
      fila={(f) => (
        <>
          <Td className="font-semibold text-ink">{f.nombre}</Td>
          <Td>
            <Pill tone={TONO_FIGURA[f.tipofigura] ?? "neutral"}>
              {f.tipofigura} {nombreFigura(f.tipofigura)}
            </Pill>
          </Td>
          <Td className="font-mono text-[12.5px]">{f.rfc || f.numregidtrib}</Td>
          <Td className="text-[12.5px] text-ink-2">
            {f.tipofigura === "01" ? <span className="font-mono">{f.numlicencia}</span> : f.partes.map((p) => p.partetransporte).join(", ")}
          </Td>
        </>
      )}
      Formulario={FiguraForm}
    />
  );
}

export function FiguraForm({ rfc, inicial, onCerrar, onGuardado }: FormularioCPProps<FiguraCP>) {
  const [f, setF] = useState<FiguraCP>(() => (inicial ? { ...inicial, partes: [...inicial.partes] } : figuraVacia()));
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const partesCat = useTablaSat("SAT_CCP_PARTES_TRANSPORTE");

  const errores = validarFigura(f);
  const set = (c: Partial<FiguraCP>) => setF((prev) => ({ ...prev, ...c }));
  const extranjero = !!f.residenciafiscal && f.residenciafiscal !== "MEX";
  const pidePartes = f.tipofigura === "02" || f.tipofigura === "03";

  async function guardar() {
    setIntentado(true);
    setError(null);
    if (Object.keys(errores).length > 0) return;
    setGuardando(true);
    const r = await guardarCP(rfc, "figura", {
      ...f,
      rfc: f.rfc.trim().toUpperCase(),
      partes: pidePartes ? f.partes : [],
      numlicencia: f.tipofigura === "01" ? f.numlicencia.trim() : f.numlicencia,
    });
    setGuardando(false);
    if (r.ok) onGuardado(r.registro);
    else setError(r.error);
  }

  function alternarParte(id: string) {
    set({
      partes: f.partes.some((p) => p.partetransporte === id)
        ? f.partes.filter((p) => p.partetransporte !== id)
        : [...f.partes, { partetransporte: id }],
    });
  }

  return (
    <Modal
      title={inicial ? "Editar figura de transporte" : "Nueva figura de transporte"}
      onClose={onCerrar}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar figura"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Note tone="danger">{error}</Note>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoCP label="Tipo de figura" nombre="tipofigura" errores={errores} mostrar={intentado}>
            <SelectTablaSat tabla="SAT_CCP_FIGURAS_TRANSPORTE" value={f.tipofigura} onChange={(id) => set({ tipofigura: id })} />
          </CampoCP>
          <CampoCP label="Residencia fiscal" nombre="residenciafiscal" errores={errores} mostrar={intentado} hint="Solo si es extranjero">
            <SelectTablaSat
              tabla="SAT_GEO_PAISES"
              value={f.residenciafiscal}
              placeholder="México"
              onChange={(id) => set({ residenciafiscal: id === "MEX" ? "" : id })}
            />
          </CampoCP>
          <CampoCP label="Nombre o razón social" nombre="nombre" errores={errores} mostrar={intentado} className="sm:col-span-2">
            <TextoCP value={f.nombre} onChange={(v) => set({ nombre: v })} invalid={intentado && !!errores.nombre} />
          </CampoCP>
          {extranjero ? (
            <CampoCP label="Registro de identidad tributaria" nombre="numregidtrib" errores={errores} mostrar={intentado}>
              <TextoCP value={f.numregidtrib} onChange={(v) => set({ numregidtrib: v })} mono invalid={intentado && !!errores.numregidtrib} />
            </CampoCP>
          ) : (
            <CampoCP label="RFC" nombre="rfc" errores={errores} mostrar={intentado}>
              <TextoCP value={f.rfc} onChange={(v) => set({ rfc: v })} mayusculas mono maxLength={13} invalid={intentado && !!errores.rfc} />
            </CampoCP>
          )}
          {f.tipofigura === "01" && (
            <CampoCP label="Número de licencia" nombre="numlicencia" errores={errores} mostrar={intentado}>
              <TextoCP value={f.numlicencia} onChange={(v) => set({ numlicencia: v })} mono invalid={intentado && !!errores.numlicencia} />
            </CampoCP>
          )}
        </div>

        {pidePartes && (
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-2">Partes del transporte que {f.tipofigura === "02" ? "le pertenecen" : "arrienda"}</p>
            <div className="flex flex-wrap gap-2">
              {partesCat.map((p) => {
                const on = f.partes.some((x) => x.partetransporte === p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => alternarParte(p.id)}
                    aria-pressed={on}
                    className={
                      "focus-brand rounded-[10px] border px-3 py-1.5 text-[12.5px] transition " +
                      (on ? "border-brand bg-brand-050 font-semibold text-brand-600" : "border-line text-ink-2 hover:border-ink-4")
                    }
                  >
                    <span className="font-mono">{p.id}</span> {p.texto}
                  </button>
                );
              })}
            </div>
            {intentado && errores.partes && <p className="mt-1.5 text-[12px] text-danger">{errores.partes}</p>}
          </div>
        )}

        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input
            type="checkbox"
            checked={f.domicilio === "SI"}
            onChange={(e) => set({ domicilio: e.target.checked ? "SI" : "NO" })}
          />
          Agregar su domicilio
        </label>
        {f.domicilio === "SI" && <DomicilioCP valor={f} onChange={set} errores={errores} mostrar={intentado} />}
      </div>
    </Modal>
  );
}
