"use client";

import { useState } from "react";
import { Button, Modal, Note, Pill, Segmented, Td, useToast } from "@/components/ui";
import { ImportarMercanciasModal } from "@/components/cartaPorte/ImportarMercanciasModal";
import { BuscadorClaveSat } from "@/components/facturas/BuscadorClaveSat";
import { CatalogoCP, guardarCP, type FormularioCPProps } from "./CatalogoCP";
import { BuscadorTablaSat, CampoCP, SelectTablaSat, TextoCP } from "./CamposCP";
import { mercanciaVacia, validarMercancia, type MercanciaCP, type PaginaCP } from "@/lib/cartaPorteShared";

export function MercanciasSection({ rfc, inicial }: { rfc: string; inicial: PaginaCP<MercanciaCP> }) {
  return (
    <CatalogoCP<MercanciaCP>
      rfc={rfc}
      entidad="mercancia"
      inicial={inicial}
      titulo="Mercancías"
      descripcion="Lo que transportas, con su clave de carta porte y su peso por unidad."
      nuevo="Nueva mercancía"
      vacio={{ titulo: "Sin mercancías todavía", descripcion: "Captúralas una por una o impórtalas desde la plantilla de Excel." }}
      encabezados={["Descripción", "Clave carta porte", "Unidad", "Peso por unidad", "Peligrosa"]}
      nombreDe={(m) => m.descripcion.slice(0, 60)}
      fila={(m) => (
        <>
          <Td className="max-w-[360px] truncate font-semibold text-ink">{m.descripcion}</Td>
          <Td className="font-mono text-[12.5px]">{m.claveprodcp}</Td>
          <Td className="text-[12.5px]">
            <span className="font-mono">{m.claveuni}</span> {m.unidad}
          </Td>
          <Td className="font-mono text-[12.5px]">{m.pesokg ? `${m.pesokg} kg` : "—"}</Td>
          <Td>{m.materialpeligroso === "Sí" ? <Pill tone="warn">{m.clavepeligroso}</Pill> : <span className="text-[12.5px] text-ink-3">No</span>}</Td>
        </>
      )}
      Formulario={MercanciaForm}
      accionExtra={(recargar) => <ImportarAlCatalogo rfc={rfc} recargar={recargar} />}
    />
  );
}

function ImportarAlCatalogo({ rfc, recargar }: { rfc: string; recargar: () => void }) {
  const [abierto, setAbierto] = useState(false);
  const toast = useToast();
  return (
    <>
      <Button variant="secondary" onClick={() => setAbierto(true)}>
        Importar desde Excel
      </Button>
      {abierto && (
        <ImportarMercanciasModal
          modo="catalogo"
          rfc={rfc}
          onCerrar={() => setAbierto(false)}
          onGuardadas={(total, nuevas) => {
            setAbierto(false);
            recargar();
            const actualizadas = total - nuevas;
            toast(
              `${nuevas.toLocaleString("es-MX")} mercancía${nuevas === 1 ? "" : "s"} nueva${nuevas === 1 ? "" : "s"}` +
                (actualizadas > 0 ? ` · ${actualizadas.toLocaleString("es-MX")} ya estaban y se actualizaron` : "")
            );
          }}
        />
      )}
    </>
  );
}

type ResultadoClaveCP = { id: string; texto: string; material_peligroso?: string };

export function MercanciaForm({ rfc, inicial, onCerrar, onGuardado }: FormularioCPProps<MercanciaCP>) {
  const [m, setM] = useState<MercanciaCP>(() => (inicial ? { ...inicial } : mercanciaVacia()));
  const [textoClaveCP, setTextoClaveCP] = useState("");
  // "0" no puede ser peligrosa, "1" siempre, "0,1" depende. Al editar un
  // registro guardado no se sabe hasta volver a elegir la clave: si ya decía
  // "Sí", se respeta.
  const [peligrosoSat, setPeligrosoSat] = useState<string>(inicial?.materialpeligroso ? "0,1" : "");
  const [verMas, setVerMas] = useState<"" | "cofepris" | "comext">("");
  const [intentado, setIntentado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  const pidePeligroso = peligrosoSat.includes("1");
  const errores = validarMercancia(m, pidePeligroso);
  const set = (c: Partial<MercanciaCP>) => setM((prev) => ({ ...prev, ...c }));

  async function guardar() {
    setIntentado(true);
    setError(null);
    if (Object.keys(errores).length > 0) return;
    setGuardando(true);
    const r = await guardarCP(rfc, "mercancia", {
      ...m,
      materialpeligroso: pidePeligroso ? m.materialpeligroso : "",
      ...(pidePeligroso && m.materialpeligroso === "Sí" ? {} : { clavepeligroso: "", embalaje: "", descembalaje: "" }),
    });
    setGuardando(false);
    if (r.ok) onGuardado(r.registro);
    else setError(r.error);
  }

  return (
    <Modal
      title={inicial ? "Editar mercancía" : "Nueva mercancía"}
      onClose={onCerrar}
      wide
      footer={
        <>
          <Button variant="ghost" onClick={onCerrar}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando…" : "Guardar mercancía"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && <Note tone="danger">{error}</Note>}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <CampoCP label="Clave de bienes transportados" nombre="claveprodcp" errores={errores} mostrar={intentado} hint="Catálogo de carta porte (c_ClaveProdServCP)">
            <BuscadorClaveSat<ResultadoClaveCP>
              catalogo="productoServicioCartaPorte"
              valorId={m.claveprodcp}
              valorTexto={textoClaveCP}
              placeholder="Clave o descripción"
              invalid={intentado && !!errores.claveprodcp}
              onEscribir={(v) => {
                set({ claveprodcp: v.trim() });
                setTextoClaveCP("");
              }}
              onElegir={(r) => {
                set({ claveprodcp: r.id, claveprod: m.claveprod || r.id, descripcion: m.descripcion || r.texto });
                setTextoClaveCP(r.texto);
                setPeligrosoSat(r.material_peligroso ?? "");
                if (r.material_peligroso === "1") set({ materialpeligroso: "Sí" });
              }}
            />
          </CampoCP>
          <CampoCP label="Clave de producto o servicio" nombre="claveprod" errores={errores} mostrar={intentado} hint="La del concepto en el CFDI; casi siempre la misma">
            <BuscadorClaveSat
              catalogo="productoServicio"
              valorId={m.claveprod}
              placeholder="Clave o descripción"
              onEscribir={(v) => set({ claveprod: v.trim() })}
              onElegir={(r) => set({ claveprod: r.id })}
            />
          </CampoCP>
          <CampoCP label="Descripción" nombre="descripcion" errores={errores} mostrar={intentado} className="sm:col-span-2">
            <TextoCP value={m.descripcion} onChange={(v) => set({ descripcion: v })} maxLength={1000} invalid={intentado && !!errores.descripcion} />
          </CampoCP>
          <CampoCP label="Clave de unidad" nombre="claveuni" errores={errores} mostrar={intentado}>
            <BuscadorClaveSat
              catalogo="claveUnidad"
              valorId={m.claveuni}
              placeholder="H87, KGM, XBX…"
              invalid={intentado && !!errores.claveuni}
              onEscribir={(v) => set({ claveuni: v.trim().toUpperCase() })}
              onElegir={(r) => set({ claveuni: r.id, unidad: m.unidad || r.texto.slice(0, 20) })}
            />
          </CampoCP>
          <CampoCP label="Unidad (texto)" nombre="unidad" errores={errores} mostrar={intentado}>
            <TextoCP value={m.unidad} onChange={(v) => set({ unidad: v })} maxLength={20} placeholder="Pieza, Caja, Kilogramo" />
          </CampoCP>
          <CampoCP label="Peso por unidad (kg)" nombre="pesokg" errores={errores} mostrar={intentado}>
            <TextoCP value={m.pesokg} onChange={(v) => set({ pesokg: v })} inputMode="decimal" mono invalid={intentado && !!errores.pesokg} />
          </CampoCP>
          <CampoCP label="Dimensiones" nombre="dimensiones" errores={errores} mostrar={intentado} hint="Largo/alto/ancho: 30/40/50cm o 12/16/20plg">
            <TextoCP value={m.dimensiones} onChange={(v) => set({ dimensiones: v })} mono invalid={intentado && !!errores.dimensiones} />
          </CampoCP>
          <CampoCP label="Valor por unidad" nombre="valor" errores={errores} mostrar={intentado}>
            <TextoCP value={m.valor} onChange={(v) => set({ valor: v })} inputMode="decimal" mono invalid={intentado && !!errores.valor} />
          </CampoCP>
          <CampoCP label="Moneda" nombre="moneda" errores={errores} mostrar={intentado}>
            <SelectTablaSat tabla="SAT_CFDI_MONEDAS" value={m.moneda} onChange={(id) => set({ moneda: id })} />
          </CampoCP>
        </div>

        {pidePeligroso && (
          <div className="space-y-3 rounded-xl border border-line bg-surface-2 p-3.5">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[13px] font-semibold text-ink">¿Es material peligroso?</span>
              {peligrosoSat === "1" ? (
                <Pill tone="warn">El SAT la clasifica siempre como peligrosa</Pill>
              ) : (
                <Segmented
                  ariaLabel="Material peligroso"
                  value={m.materialpeligroso || ""}
                  onChange={(v) => set({ materialpeligroso: v })}
                  options={[
                    { value: "No", label: "No" },
                    { value: "Sí", label: "Sí" },
                  ]}
                />
              )}
            </div>
            {intentado && errores.materialpeligroso && <p className="text-[12px] text-danger">{errores.materialpeligroso}</p>}
            {m.materialpeligroso === "Sí" && (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <CampoCP label="Clave del material peligroso" nombre="clavepeligroso" errores={errores} mostrar={intentado} hint="Número ONU (UN1075…)">
                  <BuscadorTablaSat
                    tabla="SAT_CCP_MATERIALES_PELIGROSOS"
                    value={m.clavepeligroso}
                    invalid={intentado && !!errores.clavepeligroso}
                    onChange={(id) => set({ clavepeligroso: id })}
                  />
                </CampoCP>
                <CampoCP label="Embalaje" nombre="embalaje" errores={errores} mostrar={intentado}>
                  <SelectTablaSat
                    tabla="SAT_CCP_TIPOS_EMBALAJE"
                    value={m.embalaje}
                    invalid={intentado && !!errores.embalaje}
                    onChange={(id, fila) => set({ embalaje: id, descembalaje: m.descembalaje || (fila?.texto ?? "") })}
                  />
                </CampoCP>
                <CampoCP label="Descripción del embalaje" nombre="descembalaje" errores={errores} mostrar={intentado} className="sm:col-span-2">
                  <TextoCP value={m.descembalaje} onChange={(v) => set({ descembalaje: v })} />
                </CampoCP>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant={verMas === "comext" ? "secondary" : "ghost"} onClick={() => setVerMas(verMas === "comext" ? "" : "comext")}>
            Comercio exterior e importación
          </Button>
          <Button size="sm" variant={verMas === "cofepris" ? "secondary" : "ghost"} onClick={() => setVerMas(verMas === "cofepris" ? "" : "cofepris")}>
            Datos COFEPRIS
          </Button>
        </div>

        {verMas === "comext" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoCP label="Fracción arancelaria" nombre="FraccionArrancelaria" errores={errores} mostrar={intentado}>
              <TextoCP value={m.FraccionArrancelaria} onChange={(v) => set({ FraccionArrancelaria: v })} mono />
            </CampoCP>
            <CampoCP label="Tipo de materia" nombre="TipoMateria" errores={errores} mostrar={intentado}>
              <SelectTablaSat tabla="SAT_CCP_TIPOS_MATERIA" value={m.TipoMateria} onChange={(id) => set({ TipoMateria: id })} />
            </CampoCP>
            <CampoCP label="Descripción de la materia" nombre="DescripcionMateria" errores={errores} mostrar={intentado} className="sm:col-span-2">
              <TextoCP value={m.DescripcionMateria} onChange={(v) => set({ DescripcionMateria: v })} />
            </CampoCP>
            <CampoCP label="Permiso de importación" nombre="PermisoImportacion" errores={errores} mostrar={intentado}>
              <TextoCP value={m.PermisoImportacion} onChange={(v) => set({ PermisoImportacion: v })} />
            </CampoCP>
            <CampoCP label="Folio de importación VUCEM" nombre="FolioImpoVUCEM" errores={errores} mostrar={intentado}>
              <TextoCP value={m.FolioImpoVUCEM} onChange={(v) => set({ FolioImpoVUCEM: v })} mono />
            </CampoCP>
            <CampoCP label="Razón social de la importadora" nombre="RazonSocialEmpImp" errores={errores} mostrar={intentado} className="sm:col-span-2">
              <TextoCP value={m.RazonSocialEmpImp} onChange={(v) => set({ RazonSocialEmpImp: v })} />
            </CampoCP>
          </div>
        )}

        {verMas === "cofepris" && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <CampoCP label="Sector COFEPRIS" nombre="sectorcofepris" errores={errores} mostrar={intentado}>
              <SelectTablaSat tabla="SAT_CCP_SECTORES_COFEPRIS" value={m.sectorcofepris} onChange={(id) => set({ sectorcofepris: id })} />
            </CampoCP>
            <CampoCP label="Forma farmacéutica" nombre="FormaFarmaceutica" errores={errores} mostrar={intentado}>
              <SelectTablaSat tabla="SAT_CCP_FORMAS_FARMACEUTICAS" value={m.FormaFarmaceutica} onChange={(id) => set({ FormaFarmaceutica: id })} />
            </CampoCP>
            <CampoCP label="Condiciones especiales de transporte" nombre="CondicionesEspTransp" errores={errores} mostrar={intentado}>
              <SelectTablaSat tabla="SAT_CCP_CONDICIONES_ESPECIALES" value={m.CondicionesEspTransp} onChange={(id) => set({ CondicionesEspTransp: id })} />
            </CampoCP>
            <CampoCP label="Registro sanitario o folio de autorización" nombre="RegistroSanitarioFolioAutorizacion" errores={errores} mostrar={intentado}>
              <TextoCP value={m.RegistroSanitarioFolioAutorizacion} onChange={(v) => set({ RegistroSanitarioFolioAutorizacion: v })} />
            </CampoCP>
            {(
              [
                ["DenominacionGenericaProd", "Denominación genérica"],
                ["DenominacionDistintivaProd", "Denominación distintiva"],
                ["Fabricante", "Fabricante"],
                ["LoteMedicamento", "Lote"],
                ["FechaCaducidad", "Fecha de caducidad (AAAA-MM-DD)"],
                ["NombreIngredienteActivo", "Ingrediente activo"],
                ["NomQuimico", "Nombre químico"],
                ["NumCAS", "Número CAS"],
                ["NumRegSanPlagCOFEPRIS", "Registro sanitario de plaguicidas"],
                ["DatosFabricante", "Datos del fabricante"],
                ["DatosFormulador", "Datos del formulador"],
                ["DatosMaquilador", "Datos del maquilador"],
                ["UsoAutorizado", "Uso autorizado"],
              ] as const
            ).map(([campo, etiqueta]) => (
              <CampoCP key={campo} label={etiqueta} nombre={campo} errores={errores} mostrar={intentado}>
                <TextoCP value={m[campo]} onChange={(v) => set({ [campo]: v } as Partial<MercanciaCP>)} />
              </CampoCP>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
