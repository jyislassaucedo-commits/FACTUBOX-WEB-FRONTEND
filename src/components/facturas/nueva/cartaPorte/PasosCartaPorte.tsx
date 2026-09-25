"use client";

/*
   Pasos de la carta porte dentro del asistente de Nueva factura. Igual que
   los demás pasos (Pasos.tsx): son el cuerpo de la pantalla; la pregunta, el
   riel, el comprobante y los botones los pone el asistente.

   Transporte, figuras, ubicaciones y mercancías se eligen de los catálogos
   del emisor (o se crean ahí mismo con los mismos formularios de los
   catálogos) y se COPIAN al borrador: ver lib/cartaPorte/borrador.ts.
*/

import { useEffect, useMemo, useState } from "react";
import { Button, Field, FieldError, Note, Pill, SearchInput, Segmented, cx, inputClass, useToast } from "@/components/ui";
import { ImportarMercanciasModal } from "@/components/cartaPorte/ImportarMercanciasModal";
import { SelectTablaSat } from "@/components/cartaPorte/catalogos/CamposCP";
import { TransportePanel } from "@/components/cartaPorte/catalogos/Transportes";
import { FiguraForm } from "@/components/cartaPorte/catalogos/Figuras";
import { UbicacionForm } from "@/components/cartaPorte/catalogos/Ubicaciones";
import { MercanciaForm } from "@/components/cartaPorte/catalogos/Mercancias";
import { useTablaSat } from "@/lib/useTablaSat";
import type { Comun } from "../Pasos";
import { cambiosPorPapel } from "@/lib/facturaNueva";
import {
  MEDIOS_CP,
  nombreMedio,
  type EntidadCP,
  type FiguraCP,
  type MedioCP,
  type MercanciaCP,
  type RegistroCP,
  type TransporteCP,
  type UbicacionCP,
} from "@/lib/cartaPorteShared";
import {
  idsUbicacion,
  mercanciaDesde,
  paradaDesde,
  redondear,
  totalesCartaPorte,
  type CartaPorteBorrador,
  type MercanciaViaje,
  type PapelCP,
  type UbicacionViaje,
} from "@/lib/cartaPorte/borrador";

function mensajeDe(c: Comun, campo: string) {
  if (!c.mostrarErrores) return undefined;
  return c.problemas.find((p) => p.campo === campo)?.mensaje;
}

/** Cambia solo la carta porte del borrador. */
function useCP(c: Comun) {
  const cp = c.borrador.cartaPorte!;
  const setCP = (cambios: Partial<CartaPorteBorrador>) => c.set({ cartaPorte: { ...cp, ...cambios } });
  return { cp, setCP };
}

/** Errores del paso que no son de un campo concreto, en una nota. */
function ProblemasSueltos({ c, campos }: { c: Comun; campos: string[] }) {
  if (!c.mostrarErrores) return null;
  const lista = c.problemas.filter((p) => campos.includes(p.campo));
  if (lista.length === 0) return null;
  return (
    <Note tone="danger">
      <ul className="list-disc space-y-0.5 pl-4">
        {lista.map((p, i) => (
          <li key={i}>{p.mensaje}</li>
        ))}
      </ul>
    </Note>
  );
}

/* -------------------------------------------------------------------------- */
/* Elegir de un catálogo                                                      */
/* -------------------------------------------------------------------------- */

function useCatalogo<T extends RegistroCP>(rfc: string, entidad: EntidadCP, q: string, version: number) {
  const [datos, setDatos] = useState<{ clave: string; registros: T[]; total: number } | null>(null);
  const clave = `${rfc}|${entidad}|${q}|${version}`;
  useEffect(() => {
    if (!rfc) return;
    let vivo = true;
    const t = setTimeout(() => {
      const params = new URLSearchParams({ q, por: "50" });
      fetch(`/api/empresas/${encodeURIComponent(rfc)}/carta-porte/${entidad}?${params}`)
        .then((r) => r.json())
        .then((b) => vivo && setDatos({ clave, registros: b.registros ?? [], total: b.total ?? 0 }))
        .catch(() => vivo && setDatos({ clave, registros: [], total: 0 }));
    }, 250);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [rfc, entidad, q, clave]);
  const vigente = datos?.clave === clave ? datos : null;
  return { registros: vigente?.registros ?? [], total: vigente?.total ?? 0, cargando: vigente === null };
}

/** Lista con buscador de un catálogo del emisor, con un botón por fila. */
function ListaCatalogo<T extends RegistroCP>({
  rfc,
  entidad,
  version,
  filtrar,
  titulo,
  subtitulo,
  accion,
  vacio,
}: {
  rfc: string;
  entidad: EntidadCP;
  version: number;
  filtrar?: (r: T) => boolean;
  titulo: (r: T) => React.ReactNode;
  subtitulo?: (r: T) => React.ReactNode;
  accion: (r: T) => React.ReactNode;
  vacio: string;
}) {
  const [q, setQ] = useState("");
  const { registros, cargando } = useCatalogo<T>(rfc, entidad, q.trim(), version);
  const visibles = filtrar ? registros.filter(filtrar) : registros;
  return (
    <div className="space-y-2">
      <SearchInput placeholder="Buscar en tus guardados…" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="divide-y divide-line-2 rounded-xl border border-line">
        {cargando ? (
          <p className="px-3.5 py-3 text-[12.5px] text-ink-4">Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className="px-3.5 py-3 text-[12.5px] text-ink-3">{q.trim() ? "Nada coincide con la búsqueda." : vacio}</p>
        ) : (
          visibles.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{titulo(r)}</p>
                {subtitulo && <p className="truncate text-[12px] text-ink-3">{subtitulo(r)}</p>}
              </div>
              {accion(r)}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Datos del traslado                                                         */
/* -------------------------------------------------------------------------- */

export function PasoCpGeneral(c: Comun) {
  const { cp, setCP } = useCP(c);
  const regimenes = useTablaSat("SAT_CCP_REGIMENES_ADUANEROS");
  const err = (campo: string) => mensajeDe(c, campo);

  function cambiarMedio(medio: MedioCP) {
    // El transporte y las estaciones dependen del medio: se sueltan si ya no aplican.
    setCP({
      medio,
      transporte: cp.transporte?.tipotransporte === medio ? cp.transporte : null,
    });
  }

  return (
    <div className="space-y-5">
      <Field label="Medio de transporte">
        <Segmented<MedioCP>
          ariaLabel="Medio de transporte"
          value={cp.medio}
          onChange={cambiarMedio}
          options={MEDIOS_CP.map((m) => ({ value: m.id, label: m.nombre }))}
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Unidad de peso" hint="En qué se expresan los pesos de la mercancía. Casi siempre KGM.">
          <SelectTablaSat tabla="SAT_CCP_CLAVES_UNIDADES" value={cp.unidadPeso} onChange={(id) => setCP({ unidadPeso: id })} invalid={Boolean(err("unidadPeso"))} />
          <FieldError mensaje={err("unidadPeso")} />
        </Field>
        <Field label="¿Cruza la frontera?">
          <Segmented<"No" | "Sí">
            ariaLabel="Transporte internacional"
            value={cp.transpInternac}
            onChange={(v) => setCP({ transpInternac: v, ...(v === "No" ? { entradaSalidaMerc: "", paisOrigenDestino: "", regimenesAduaneros: [] } : {}) })}
            options={[
              { value: "No", label: "No, es nacional" },
              { value: "Sí", label: "Sí, internacional" },
            ]}
          />
        </Field>
      </div>

      {cp.transpInternac === "Sí" && (
        <div className="space-y-4 rounded-xl border border-line bg-surface-2 p-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="La mercancía…">
              <Segmented<"Entrada" | "Salida">
                ariaLabel="Entrada o salida"
                value={cp.entradaSalidaMerc || "Entrada"}
                onChange={(v) => setCP({ entradaSalidaMerc: v })}
                options={[
                  { value: "Entrada", label: "Entra al país" },
                  { value: "Salida", label: "Sale del país" },
                ]}
              />
              <FieldError mensaje={err("entradaSalidaMerc")} />
            </Field>
            <Field label={cp.entradaSalidaMerc === "Salida" ? "País de destino" : "País de origen"}>
              <SelectTablaSat tabla="SAT_GEO_PAISES" value={cp.paisOrigenDestino} onChange={(id) => setCP({ paisOrigenDestino: id })} invalid={Boolean(err("paisOrigenDestino"))} />
              <FieldError mensaje={err("paisOrigenDestino")} />
            </Field>
          </div>
          <div className="space-y-2">
            <p className="text-xs font-semibold text-ink-2">Régimen aduanero (hasta 10)</p>
            <div className="flex flex-wrap gap-2">
              {regimenes.map((r) => {
                const on = cp.regimenesAduaneros.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setCP({
                        regimenesAduaneros: on
                          ? cp.regimenesAduaneros.filter((x) => x !== r.id)
                          : [...cp.regimenesAduaneros, r.id].slice(0, 10),
                      })
                    }
                    className={cx(
                      "focus-brand rounded-[10px] border px-3 py-1.5 text-[12.5px] transition",
                      on ? "border-brand bg-brand-050 font-semibold text-brand-600" : "border-line bg-surface text-ink-2 hover:border-ink-4"
                    )}
                  >
                    <span className="font-mono">{r.id}</span> {r.texto}
                  </button>
                );
              })}
            </div>
            <FieldError mensaje={err("regimenesAduaneros")} />
          </div>
        </div>
      )}

      <div className="space-y-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={cp.logisticaInversa} onChange={(e) => setCP({ logisticaInversa: e.target.checked })} />
          Es logística inversa (recolección o devolución)
        </label>
        <label className="flex items-center gap-2 text-[13px] text-ink-2">
          <input type="checkbox" className="size-4 accent-[var(--brand)]" checked={cp.registroISTMO} onChange={(e) => setCP({ registroISTMO: e.target.checked, ...(e.target.checked ? {} : { ubicacionPoloOrigen: "", ubicacionPoloDestino: "" }) })} />
          Pasa por el Corredor Interoceánico del Istmo de Tehuantepec
        </label>
        {cp.registroISTMO && (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Polo de origen">
              <SelectTablaSat tabla="SAT_CCP_REGISTROS_ISTMO" value={cp.ubicacionPoloOrigen} onChange={(id) => setCP({ ubicacionPoloOrigen: id })} />
            </Field>
            <Field label="Polo de destino">
              <SelectTablaSat tabla="SAT_CCP_REGISTROS_ISTMO" value={cp.ubicacionPoloDestino} onChange={(id) => setCP({ ubicacionPoloDestino: id })} />
            </Field>
            <div className="sm:col-span-2">
              <FieldError mensaje={err("registroISTMO")} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Transporte                                                                 */
/* -------------------------------------------------------------------------- */

function detalleTransporte(t: TransporteCP) {
  if (t.autotransporte) {
    const a = t.autotransporte;
    return [a.configvehicular, a.placavm && `placa ${a.placavm}`, a.aniomodelovm, a.remolques.length > 0 && `${a.remolques.length} remolque${a.remolques.length > 1 ? "s" : ""}`, t.permsct && `permiso ${t.permsct}`]
      .filter(Boolean)
      .join(" · ");
  }
  if (t.maritimo) return [t.maritimo.tipoembarcacion, t.maritimo.nombreembarc, t.maritimo.matricula].filter(Boolean).join(" · ");
  if (t.aereo) return [t.aereo.codigotransportista, t.aereo.matriculaaeronave, `guía ${t.aereo.numeroguia}`].filter(Boolean).join(" · ");
  if (t.ferroviario) return [t.ferroviario.tipodeservicio, `${t.ferroviario.carros.length} carros`].join(" · ");
  return "";
}

export function PasoCpTransporte(c: Comun) {
  const { cp, setCP } = useCP(c);
  const rfc = c.borrador.rfcEmisor;
  const [nuevo, setNuevo] = useState(false);
  const [version, setVersion] = useState(0);
  const t = cp.transporte;

  return (
    <div className="space-y-4">
      <ProblemasSueltos c={c} campos={["transporte", "Pesobrutovehicular", "permsct", "seguro"]} />
      {t ? (
        <div className="flex items-start gap-3 rounded-xl border border-brand bg-surface px-4 py-3 shadow-[0_0_0_3px_var(--brand-050)]">
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">{t.alias || "Transporte"}</p>
            <p className="text-[12.5px] text-ink-2">{detalleTransporte(t)}</p>
          </div>
          <Pill tone="ok">Elegido</Pill>
          <Button size="sm" variant="ghost" onClick={() => setCP({ transporte: null })}>
            Cambiar
          </Button>
        </div>
      ) : (
        <p className="text-[13px] text-ink-2">
          Elige una unidad de {nombreMedio(cp.medio).toLowerCase()} de tus transportes guardados, o registra una nueva.
        </p>
      )}

      {!t && (
        <ListaCatalogo<TransporteCP>
          rfc={rfc}
          entidad="transporte"
          version={version}
          filtrar={(r) => r.tipotransporte === cp.medio}
          vacio={`No tienes transportes de ${nombreMedio(cp.medio).toLowerCase()} guardados.`}
          titulo={(r) => r.alias || "Transporte"}
          subtitulo={detalleTransporte}
          accion={(r) => (
            <Button size="sm" variant="secondary" onClick={() => setCP({ transporte: r })}>
              Usar
            </Button>
          )}
        />
      )}
      {!t && (
        <Button variant="ghost" onClick={() => setNuevo(true)}>
          Registrar un transporte nuevo
        </Button>
      )}

      {nuevo && (
        <TransportePanel
          rfc={rfc}
          inicial={null}
          onCerrar={() => setNuevo(false)}
          onGuardado={(r) => {
            setNuevo(false);
            setVersion((v) => v + 1);
            if (r.tipotransporte === cp.medio) setCP({ transporte: r });
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Figuras                                                                    */
/* -------------------------------------------------------------------------- */

export function PasoCpFiguras(c: Comun) {
  const { cp, setCP } = useCP(c);
  const rfc = c.borrador.rfcEmisor;
  const [nueva, setNueva] = useState(false);
  const [version, setVersion] = useState(0);
  const tipos = useTablaSat("SAT_CCP_FIGURAS_TRANSPORTE");
  const tipoTexto = (id: string) => tipos.find((t) => t.id === id)?.texto ?? id;
  const elegida = (f: FiguraCP) => cp.figuras.some((x) => x.id === f.id);

  return (
    <div className="space-y-4">
      <ProblemasSueltos c={c} campos={["figuras"]} />
      {cp.figuras.length > 0 && (
        <div className="divide-y divide-line-2 rounded-xl border border-line">
          {cp.figuras.map((f) => (
            <div key={f.id ?? f.rfc} className="flex items-center gap-3 px-3.5 py-2.5">
              <Pill tone={f.tipofigura === "01" ? "brand" : "info"}>
                {f.tipofigura} {tipoTexto(f.tipofigura)}
              </Pill>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-semibold text-ink">{f.nombre}</p>
                <p className="truncate font-mono text-[12px] text-ink-3">
                  {f.rfc || f.numregidtrib}
                  {f.tipofigura === "01" && f.numlicencia ? ` · licencia ${f.numlicencia}` : ""}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setCP({ figuras: cp.figuras.filter((x) => x !== f) })}>
                Quitar
              </Button>
            </div>
          ))}
        </div>
      )}
      <ListaCatalogo<FiguraCP>
        rfc={rfc}
        entidad="figura"
        version={version}
        vacio="No tienes figuras guardadas."
        titulo={(r) => r.nombre}
        subtitulo={(r) => `${r.tipofigura} ${tipoTexto(r.tipofigura)} · ${r.rfc || r.numregidtrib}`}
        accion={(r) =>
          elegida(r) ? (
            <Pill tone="ok">Agregada</Pill>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setCP({ figuras: [...cp.figuras, r] })}>
              Agregar
            </Button>
          )
        }
      />
      <Button variant="ghost" onClick={() => setNueva(true)}>
        Registrar una figura nueva
      </Button>
      {nueva && (
        <FiguraForm
          rfc={rfc}
          inicial={null}
          onCerrar={() => setNueva(false)}
          onGuardado={(r) => {
            setNueva(false);
            setVersion((v) => v + 1);
            setCP({ figuras: [...cp.figuras, r] });
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Ubicaciones                                                                */
/* -------------------------------------------------------------------------- */

export function PasoCpUbicaciones(c: Comun) {
  const { cp, setCP } = useCP(c);
  const rfc = c.borrador.rfcEmisor;
  const [agregando, setAgregando] = useState<"Origen" | "Destino" | null>(null);
  const [nueva, setNueva] = useState<"Origen" | "Destino" | null>(null);
  const [version, setVersion] = useState(0);
  const ids = idsUbicacion(cp.ubicaciones);
  const conDistancia = cp.medio === "01" || cp.medio === "04";
  const totales = totalesCartaPorte(cp);
  const hayOrigen = cp.ubicaciones.some((u) => u.tipoUbicacion === "Origen");

  function cambiar(clave: string, cambios: Partial<UbicacionViaje>) {
    setCP({ ubicaciones: cp.ubicaciones.map((u) => (u.clave === clave ? { ...u, ...cambios } : u)) });
  }
  function mover(i: number, delta: number) {
    const lista = [...cp.ubicaciones];
    const j = i + delta;
    if (j < 0 || j >= lista.length) return;
    [lista[i], lista[j]] = [lista[j], lista[i]];
    setCP({ ubicaciones: lista });
  }
  function quitar(u: UbicacionViaje) {
    // Lo repartido a esa parada deja de tener sentido: se quita de cada mercancía.
    setCP({
      ubicaciones: cp.ubicaciones.filter((x) => x.clave !== u.clave),
      mercancias: cp.mercancias.map((m) =>
        m.cantidadTransporta.some((ct) => ct.origen === u.clave || ct.destino === u.clave)
          ? { ...m, cantidadTransporta: m.cantidadTransporta.filter((ct) => ct.origen !== u.clave && ct.destino !== u.clave) }
          : m
      ),
    });
  }
  function agregar(u: UbicacionCP, tipo: "Origen" | "Destino") {
    const parada = paradaDesde(u, tipo);
    // El origen va primero; los destinos, al final en el orden en que se agregan.
    setCP({ ubicaciones: tipo === "Origen" ? [parada, ...cp.ubicaciones] : [...cp.ubicaciones, parada] });
    setAgregando(null);
  }

  return (
    <div className="space-y-4">
      <ProblemasSueltos c={c} campos={["ubicaciones"]} />

      {cp.ubicaciones.length > 0 && (
        <ol className="space-y-0">
          {cp.ubicaciones.map((u, i) => {
            const errFecha = mensajeDe(c, `ubicacion.${u.clave}.fechaHora`);
            const errDist = mensajeDe(c, `ubicacion.${u.clave}.distancia`);
            const ultimo = i === cp.ubicaciones.length - 1;
            return (
              <li key={u.clave} className="grid grid-cols-[32px_minmax(0,1fr)] gap-x-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cx(
                      "grid size-7 flex-none place-items-center rounded-full text-[12px] font-bold",
                      u.tipoUbicacion === "Origen" ? "bg-teal-bg text-teal" : "bg-brand-050 text-brand-600",
                      (errFecha || errDist) && "ring-2 ring-warn"
                    )}
                  >
                    {String.fromCharCode(65 + i)}
                  </span>
                  {!ultimo && <span className="w-0.5 flex-1 bg-line" />}
                </div>
                <div className="mb-3 rounded-xl border border-line bg-surface p-3.5">
                  <div className="flex flex-wrap items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-[14px] font-semibold text-ink">
                        {u.nombreremdest}
                        <Pill tone={u.tipoUbicacion === "Origen" ? "teal" : "brand"}>{u.tipoUbicacion}</Pill>
                      </p>
                      <p className="mt-0.5 text-[12.5px] text-ink-2">
                        {[u.calle && `${u.calle} ${u.numeroexterior}`.trim(), u.municipio, u.estado, u.codigopostal].filter(Boolean).join(", ")}
                        {u.numestacion ? ` · estación ${u.numestacion}` : ""}
                      </p>
                      <p className="mt-0.5 font-mono text-[11.5px] text-ink-3">
                        {ids.get(u.clave)} · {u.rfcremdest || u.numregidtrib}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => mover(i, -1)} disabled={i === 0} aria-label="Subir">
                        ↑
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => mover(i, 1)} disabled={ultimo} aria-label="Bajar">
                        ↓
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => quitar(u)}>
                        Quitar
                      </Button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label={u.tipoUbicacion === "Origen" ? "Sale" : "Llega"}>
                      <input
                        type="datetime-local"
                        className={cx(inputClass, "font-mono")}
                        value={u.fechaHora}
                        aria-invalid={Boolean(errFecha)}
                        onChange={(e) => cambiar(u.clave, { fechaHora: e.target.value })}
                      />
                      <FieldError mensaje={errFecha} />
                    </Field>
                    {u.tipoUbicacion === "Destino" && conDistancia && (
                      <Field label="Distancia desde la parada anterior (km)">
                        <input
                          className={cx(inputClass, "font-mono")}
                          inputMode="decimal"
                          value={u.distancia}
                          aria-invalid={Boolean(errDist)}
                          onChange={(e) => cambiar(u.clave, { distancia: e.target.value })}
                        />
                        <FieldError mensaje={errDist} />
                      </Field>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!hayOrigen && (
          <Button variant={agregando === "Origen" ? "secondary" : "ghost"} onClick={() => setAgregando(agregando === "Origen" ? null : "Origen")}>
            Agregar origen
          </Button>
        )}
        <Button variant={agregando === "Destino" ? "secondary" : "ghost"} onClick={() => setAgregando(agregando === "Destino" ? null : "Destino")}>
          Agregar destino
        </Button>
        {conDistancia && totales.distancia > 0 && (
          <span className="ml-auto text-[13px] text-ink-2">
            Distancia total <span className="font-mono font-semibold text-ink">{totales.distancia.toLocaleString("es-MX")} km</span>
          </span>
        )}
      </div>

      {agregando && (
        <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3.5">
          <p className="text-[13px] font-semibold text-ink">Elige {agregando === "Origen" ? "el origen" : "un destino"}</p>
          <ListaCatalogo<UbicacionCP>
            rfc={rfc}
            entidad="ubicacion"
            version={version}
            vacio="No tienes ubicaciones guardadas."
            titulo={(r) => r.nombreremdest}
            subtitulo={(r) => [r.municipio, r.estado, r.codigopostal].filter(Boolean).join(", ")}
            accion={(r) => (
              <Button size="sm" variant="secondary" onClick={() => agregar(r, agregando)}>
                Usar
              </Button>
            )}
          />
          <Button variant="ghost" onClick={() => setNueva(agregando)}>
            Registrar una ubicación nueva
          </Button>
        </div>
      )}
      {nueva && (
        <UbicacionForm
          rfc={rfc}
          inicial={null}
          onCerrar={() => setNueva(null)}
          onGuardado={(r) => {
            const tipo = nueva;
            setNueva(null);
            setVersion((v) => v + 1);
            agregar(r, tipo);
          }}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Mercancías                                                                 */
/* -------------------------------------------------------------------------- */

const POR_PAGINA = 50;

export function PasoCpMercancias(c: Comun) {
  const { cp, setCP } = useCP(c);
  const toast = useToast();
  const [importando, setImportando] = useState(false);
  const rfc = c.borrador.rfcEmisor;
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [agregando, setAgregando] = useState(false);
  const [nueva, setNueva] = useState(false);
  const [version, setVersion] = useState(0);
  const [editando, setEditando] = useState<string | null>(null);
  const totales = totalesCartaPorte(cp);

  const filtradas = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return cp.mercancias;
    return cp.mercancias.filter((m) => `${m.descripcion} ${m.claveprodcp} ${m.identificador ?? ""}`.toLowerCase().includes(t));
  }, [cp.mercancias, q]);
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const pag = Math.min(pagina, paginas);
  const visibles = filtradas.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA);
  const fila = cp.mercancias.find((m) => m.clave === editando) ?? null;

  function agregar(m: MercanciaCP) {
    setCP({ mercancias: [...cp.mercancias, mercanciaDesde(m)] });
    setEditando(null);
  }

  return (
    <div className="space-y-4">
      <ProblemasSueltos c={c} campos={["mercancias"]} />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl border border-line bg-surface-2 px-4 py-2.5 text-[13px] text-ink-2">
        <span>
          <span className="font-mono font-semibold text-ink">{totales.numMercancias.toLocaleString("es-MX")}</span> mercancía{totales.numMercancias === 1 ? "" : "s"}
        </span>
        <span>
          Peso bruto <span className="font-mono font-semibold text-ink">{totales.pesoBruto.toLocaleString("es-MX", { maximumFractionDigits: 3 })}</span> {cp.unidadPeso}
        </span>
      </div>

      {cp.mercancias.length > 0 && (
        <>
          {cp.mercancias.length > POR_PAGINA && (
            <SearchInput
              placeholder="Buscar por descripción, clave o identificador…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPagina(1);
              }}
            />
          )}
          <div className="overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] text-ink-3">
                  <th className="px-3 py-2 font-medium">Mercancía</th>
                  <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                  <th className="px-3 py-2 text-right font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">Reparto</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {visibles.map((m) => (
                  <FilaMercancia key={m.clave} m={m} cp={cp} onEditar={() => setEditando(m.clave)} onQuitar={() => setCP({ mercancias: cp.mercancias.filter((x) => x.clave !== m.clave) })} />
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div className="flex items-center gap-2 text-[12.5px] text-ink-3">
              <span>
                {(pag - 1) * POR_PAGINA + 1}–{Math.min(pag * POR_PAGINA, filtradas.length)} de {filtradas.length.toLocaleString("es-MX")}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>
                Anterior
              </Button>
              <Button size="sm" variant="secondary" disabled={pag >= paginas} onClick={() => setPagina(pag + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant={agregando ? "secondary" : "ghost"} onClick={() => setAgregando((v) => !v)}>
          Agregar mercancía guardada
        </Button>
        <Button variant="ghost" onClick={() => setImportando(true)}>
          Importar desde Excel
        </Button>
        <Button variant="ghost" onClick={() => setNueva(true)}>
          Registrar una mercancía nueva
        </Button>
      </div>

      {agregando && (
        <div className="rounded-xl border border-line bg-surface-2 p-3.5">
          <ListaCatalogo<MercanciaCP>
            rfc={rfc}
            entidad="mercancia"
            version={version}
            vacio="No tienes mercancías guardadas."
            titulo={(r) => r.descripcion}
            subtitulo={(r) => `${r.claveprodcp} · ${r.claveuni} ${r.unidad}${r.pesokg ? ` · ${r.pesokg} kg por unidad` : ""}`}
            accion={(r) => (
              <Button size="sm" variant="secondary" onClick={() => agregar(r)}>
                Agregar
              </Button>
            )}
          />
        </div>
      )}
      {importando && (
        <ImportarMercanciasModal
          modo="cartaPorte"
          rfc={rfc}
          idsParadas={idsUbicacion(cp.ubicaciones)}
          yaHay={cp.mercancias.length}
          onCerrar={() => setImportando(false)}
          onImportadas={(mercancias, nuevasCatalogo) => {
            setCP({ mercancias: [...cp.mercancias, ...mercancias] });
            setImportando(false);
            setPagina(1);
            if (nuevasCatalogo !== null) setVersion((v) => v + 1);
            toast(
              `${mercancias.length.toLocaleString("es-MX")} mercancía${mercancias.length === 1 ? "" : "s"} importada${mercancias.length === 1 ? "" : "s"}` +
                (nuevasCatalogo ? ` · ${nuevasCatalogo.toLocaleString("es-MX")} nuevas en el catálogo` : "")
            );
          }}
        />
      )}
      {nueva && (
        <MercanciaForm
          rfc={rfc}
          inicial={null}
          onCerrar={() => setNueva(false)}
          onGuardado={(r) => {
            setNueva(false);
            setVersion((v) => v + 1);
            agregar(r);
          }}
        />
      )}
      {fila && (
        <EditorMercancia
          m={fila}
          cp={cp}
          onCerrar={() => setEditando(null)}
          onGuardar={(nuevaFila) => {
            setCP({ mercancias: cp.mercancias.map((x) => (x.clave === nuevaFila.clave ? nuevaFila : x)) });
            setEditando(null);
          }}
        />
      )}
    </div>
  );
}

function FilaMercancia({ m, cp, onEditar, onQuitar }: { m: MercanciaViaje; cp: CartaPorteBorrador; onEditar: () => void; onQuitar: () => void }) {
  const letra = (clave: string) => {
    const i = cp.ubicaciones.findIndex((u) => u.clave === clave);
    return i >= 0 ? String.fromCharCode(65 + i) : "?";
  };
  return (
    <tr className="border-b border-line-2 last:border-0">
      <td className="max-w-[360px] px-3 py-2">
        <p className="truncate font-medium text-ink">{m.descripcion}</p>
        <p className="font-mono text-[11.5px] text-ink-3">
          {m.identificador ? `${m.identificador} · ` : ""}
          {m.claveprodcp} · {m.claveuni}
        </p>
      </td>
      <td className="px-3 py-2 text-right font-mono">{m.cantidad}</td>
      <td className="px-3 py-2 text-right font-mono">{m.pesoTotal || <span className="text-warn">falta</span>}</td>
      <td className="px-3 py-2 text-[12px] text-ink-2">
        {m.cantidadTransporta.length === 0 ? "—" : m.cantidadTransporta.map((c) => `${letra(c.origen)}→${letra(c.destino)} ${c.cantidad}`).join(" · ")}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <Button size="sm" variant="ghost" onClick={onEditar}>
          Editar
        </Button>
        <Button size="sm" variant="ghost" onClick={onQuitar}>
          Quitar
        </Button>
      </td>
    </tr>
  );
}

/** Cantidad, peso y reparto por parada de una mercancía del viaje. */
function EditorMercancia({ m, cp, onCerrar, onGuardar }: { m: MercanciaViaje; cp: CartaPorteBorrador; onCerrar: () => void; onGuardar: (m: MercanciaViaje) => void }) {
  const [f, setF] = useState<MercanciaViaje>(m);
  const origenes = cp.ubicaciones.filter((u) => u.tipoUbicacion === "Origen");
  const destinos = cp.ubicaciones.filter((u) => u.tipoUbicacion === "Destino");
  const nombre = (clave: string) => cp.ubicaciones.find((u) => u.clave === clave)?.nombreremdest ?? "—";
  const set = (c: Partial<MercanciaViaje>) => setF((prev) => ({ ...prev, ...c }));

  function cambiarCantidad(v: string) {
    const peso = Number(f.pesokg) || 0;
    const n = Number(v) || 0;
    // El peso total sigue a la cantidad mientras el usuario no lo haya tocado.
    const pesoCalculado = peso > 0 && n > 0 ? redondear(peso * n, 3) : f.pesoTotal;
    const estabaCalculado = !f.pesoTotal || f.pesoTotal === redondear(peso * (Number(f.cantidad) || 0), 3);
    set({ cantidad: v, pesoTotal: estabaCalculado ? pesoCalculado : f.pesoTotal });
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4" role="dialog" aria-modal="true" aria-label="Editar mercancía del viaje">
      <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-xl bg-surface p-5 shadow-pop">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-[15px] font-semibold text-ink">{f.descripcion}</p>
            <p className="font-mono text-[12px] text-ink-3">
              {f.claveprodcp} · {f.claveuni} {f.unidad}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={onCerrar}>
            Cerrar
          </Button>
        </div>
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Cantidad">
              <input className={cx(inputClass, "font-mono")} inputMode="decimal" value={f.cantidad} onChange={(e) => cambiarCantidad(e.target.value)} />
            </Field>
            <Field label={`Peso total (${cp.unidadPeso})`} hint={f.pesokg ? `${f.pesokg} por unidad` : undefined}>
              <input className={cx(inputClass, "font-mono")} inputMode="decimal" value={f.pesoTotal} onChange={(e) => set({ pesoTotal: e.target.value })} />
            </Field>
            {cp.transpInternac === "Sí" && (
              <Field label="Folio fiscal del CFDI de comercio exterior">
                <input className={cx(inputClass, "font-mono")} value={f.uuidComercioExt} onChange={(e) => set({ uuidComercioExt: e.target.value.trim() })} />
              </Field>
            )}
            {cp.medio === "04" && (
              <Field label="Clave STCC">
                <input className={cx(inputClass, "font-mono")} value={f.claveSTCC} onChange={(e) => set({ claveSTCC: e.target.value.trim() })} />
              </Field>
            )}
          </div>

          {(origenes.length > 1 || destinos.length > 1) && (
            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-[13px] font-semibold text-ink">De dónde sale y a dónde llega</p>
              {f.cantidadTransporta.map((ct, i) => (
                <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_100px_auto] items-end gap-2">
                  <Field label="Sale de">
                    <select className={inputClass} value={ct.origen} onChange={(e) => set({ cantidadTransporta: f.cantidadTransporta.map((x, j) => (j === i ? { ...x, origen: e.target.value } : x)) })}>
                      {origenes.map((o) => (
                        <option key={o.clave} value={o.clave}>
                          {nombre(o.clave)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Llega a">
                    <select className={inputClass} value={ct.destino} onChange={(e) => set({ cantidadTransporta: f.cantidadTransporta.map((x, j) => (j === i ? { ...x, destino: e.target.value } : x)) })}>
                      {destinos.map((d) => (
                        <option key={d.clave} value={d.clave}>
                          {nombre(d.clave)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Cantidad">
                    <input className={cx(inputClass, "font-mono")} inputMode="decimal" value={ct.cantidad} onChange={(e) => set({ cantidadTransporta: f.cantidadTransporta.map((x, j) => (j === i ? { ...x, cantidad: e.target.value } : x)) })} />
                  </Field>
                  <Button size="sm" variant="ghost" onClick={() => set({ cantidadTransporta: f.cantidadTransporta.filter((_, j) => j !== i) })}>
                    Quitar
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="ghost"
                disabled={origenes.length === 0 || destinos.length === 0}
                onClick={() => set({ cantidadTransporta: [...f.cantidadTransporta, { origen: origenes[0].clave, destino: destinos[0].clave, cantidad: "" }] })}
              >
                Agregar tramo
              </Button>
            </div>
          )}

          {cp.medio === "02" && (
            <div className="space-y-2 rounded-xl border border-line bg-surface-2 p-3">
              <p className="text-[13px] font-semibold text-ink">Detalle (marítimo)</p>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    ["pesoBruto", "Peso bruto"],
                    ["pesoNeto", "Peso neto"],
                    ["pesoTara", "Peso tara"],
                    ["numPiezas", "Piezas"],
                  ] as const
                ).map(([campo, etiqueta]) => (
                  <Field key={campo} label={etiqueta}>
                    <input
                      className={cx(inputClass, "font-mono")}
                      inputMode="decimal"
                      value={f.detalle?.[campo] ?? ""}
                      onChange={(e) =>
                        set({ detalle: { unidadPesoMerc: f.detalle?.unidadPesoMerc || cp.unidadPeso, pesoBruto: "", pesoNeto: "", pesoTara: "", numPiezas: "", ...f.detalle, [campo]: e.target.value } })
                      }
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={onCerrar}>
              Cancelar
            </Button>
            <Button variant="primary" onClick={() => onGuardar(f)}>
              Listo
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Tu papel en el viaje (primer paso)                                         */
/* -------------------------------------------------------------------------- */

/**
 * Las cuatro opciones del escritorio (frmInicioCartaPorte), con lo que de
 * verdad pide el SAT (RMF 2026 2.7.7.1.1 y 2.7.7.1.2; Instructivo CCP 3.1,
 * Apéndices 1 y 5; Preguntas frecuentes 15 y 39).
 */
export const PAPELES: Array<{ id: PapelCP; titulo: string; que: string; timbras: string }> = [
  {
    id: "duenio",
    titulo: "Soy el dueño de la mercancía",
    que: "Es tuya y la mueves con tus propios medios: unidad propia o que tienes en arrendamiento.",
    timbras: "Traslado",
  },
  {
    id: "transportista",
    titulo: "Soy transportista",
    que: "Te pagan por mover mercancía de otro: le cobras el flete a tu cliente.",
    timbras: "Factura con carta porte",
  },
  {
    id: "intermediario",
    titulo: "Soy intermediario",
    que: "Coordinas el envío de mercancía que no es tuya y cobras por ese servicio.",
    timbras: "Factura de tu servicio",
  },
  {
    id: "blanco",
    titulo: "Carta porte en blanco",
    que: "Eliges el tipo de comprobante tú; no se te guía.",
    timbras: "Tú eliges",
  },
];

export function nombrePapel(p: PapelCP) {
  return PAPELES.find((x) => x.id === p)?.titulo.replace(/^Soy (el )?/, "").replace(/^./, (l) => l.toUpperCase()) ?? p;
}

export function PasoCpPapel(c: Comun) {
  const { cp } = useCP(c);
  const elegir = (papel: PapelCP, extra: Parameters<typeof cambiosPorPapel>[2] = {}) =>
    c.set(cambiosPorPapel(c.borrador, papel, extra));
  const ingreso = c.borrador.tipo === "I";

  const soloServicio = cp.papel === "intermediario" && !cp.transportePropio;
  const figuras = soloServicio
    ? "Ninguna: esta factura no lleva carta porte."
    : "El operador; y el propietario o arrendador si la unidad no es tuya.";
  const cobro = !ingreso
    ? "Nada: un traslado vale $0 y el receptor es tu propia empresa."
    : soloServicio
      ? "Tu servicio de intermediación (clave 78141501), a tu cliente."
      : "El flete, con una clave de servicio de transporte (p. ej. 78101802), a quien te paga el viaje.";

  return (
    <div className="space-y-4">
      <div className="space-y-2.5" role="radiogroup" aria-label="Tu papel en el viaje">
        {PAPELES.map((p) => {
          const activo = cp.papel === p.id;
          return (
            <div key={p.id}>
              <button
                type="button"
                role="radio"
                aria-checked={activo}
                onClick={() => elegir(p.id)}
                className={cx(
                  "focus-brand grid w-full grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3.5 rounded-xl border px-4 py-3.5 text-left transition",
                  activo ? "border-brand bg-brand-050" : "border-line bg-surface hover:border-ink-4"
                )}
              >
                <span
                  className={cx(
                    "mt-0.5 grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px]",
                    activo ? "border-brand" : "border-ink-4"
                  )}
                >
                  {activo && <span className="h-2 w-2 rounded-full bg-brand" />}
                </span>
                <span>
                  <span className="block text-[14.5px] font-semibold text-ink">{p.titulo}</span>
                  <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{p.que}</span>
                </span>
                <Pill tone="teal">{p.timbras}</Pill>
              </button>

              {activo && p.id === "intermediario" && (
                <div className="space-y-2 pb-1 pl-[50px] pt-2.5">
                  <p className="text-[13px] font-medium text-ink">¿La mueves con tu propio transporte?</p>
                  <Segmented
                    ariaLabel="Transporte propio"
                    value={cp.transportePropio ? "si" : "no"}
                    onChange={(v) => elegir("intermediario", { transportePropio: v === "si" })}
                    options={[
                      { value: "si", label: "Sí, con mi transporte" },
                      { value: "no", label: "No, la mueve alguien más" },
                    ]}
                  />
                </div>
              )}
              {activo && p.id === "blanco" && (
                <div className="space-y-2 pb-1 pl-[50px] pt-2.5">
                  <p className="text-[13px] font-medium text-ink">¿Qué comprobante vas a timbrar?</p>
                  <Segmented
                    ariaLabel="Tipo de comprobante"
                    value={c.borrador.tipo === "T" ? "T" : "I"}
                    onChange={(v) => elegir("blanco", { tipoEnBlanco: v as "I" | "T" })}
                    options={[
                      { value: "I", label: "Ingreso con carta porte" },
                      { value: "T", label: "Traslado" },
                    ]}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="grid gap-3 rounded-xl border border-line-2 bg-surface-2 p-4 text-[13px] sm:grid-cols-2">
        <div>
          <p className="text-[12px] text-ink-3">Qué se cobra</p>
          <p className="mt-0.5 text-ink">
            {cobro}
          </p>
        </div>
        <div>
          <p className="text-[12px] text-ink-3">Figuras que te vamos a pedir</p>
          <p className="mt-0.5 text-ink">{figuras}</p>
        </div>
        {soloServicio && (
          <p className="text-ink-2 sm:col-span-2">
            Sin vehículos propios, tú solo facturas tu servicio, sin carta porte. La carta porte del viaje te la emite a ti el
            transportista que contrataste, y con tu factura tu cliente puede deducir.
          </p>
        )}
        {cp.papel === "intermediario" && cp.transportePropio && (
          <p className="text-ink-2 sm:col-span-2">
            Con tu propio transporte cobras el servicio igual que un transportista: factura de ingreso con carta porte.
          </p>
        )}
        {cp.papel === "duenio" && (
          <ul className="list-disc space-y-1 pl-4 text-ink-2 sm:col-span-2">
            <li>Si contrataste un flete, tú no timbras carta porte: te la emite el transportista en su factura.</li>
            <li>
              Si la mercancía ya la vendiste, la factura de la venta va aparte y sin carta porte. Puedes relacionarla con este
              traslado en “CFDI relacionados” (tipo 05).
            </li>
          </ul>
        )}
      </div>
    </div>
  );
}
