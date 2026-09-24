"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx, Field, FieldError, inputClass } from "@/components/ui";
import { SelectorCatalogoSat } from "@/components/catalogosSat/SelectorCatalogoSat";
import { buscarEnTablaSat, consultarCp, useTablaSat, type FilaSat, type InfoCodigoPostal } from "@/lib/useTablaSat";
import type { Domicilio, ErroresCP } from "@/lib/cartaPorteShared";

/*
   Piezas de formulario que comparten los catálogos de carta porte (y más
   adelante los pasos del asistente): campo con su error, selectores de
   catálogos del SAT y el bloque de domicilio que se autollena por CP.
*/

/** Campo con etiqueta y el error de `errores[nombre]` debajo, si lo hay. */
export function CampoCP({
  label,
  nombre,
  errores,
  mostrar,
  hint,
  className,
  children,
}: {
  label: React.ReactNode;
  nombre: string;
  errores: ErroresCP;
  /** Solo se muestran los errores después del primer intento de guardar. */
  mostrar: boolean;
  hint?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <Field label={label} hint={hint}>
        {children}
      </Field>
      {mostrar && <FieldError mensaje={errores[nombre]} />}
    </div>
  );
}

/** Texto simple ligado a una propiedad. */
export function TextoCP({
  value,
  onChange,
  invalid,
  mayusculas,
  mono,
  ...props
}: Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> & {
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  mayusculas?: boolean;
  mono?: boolean;
}) {
  return (
    <input
      {...props}
      className={cx(inputClass, mono && "font-mono")}
      value={value}
      aria-invalid={invalid || undefined}
      onChange={(e) => onChange(mayusculas ? e.target.value.toUpperCase() : e.target.value)}
    />
  );
}

/** La columna que hace de clave: casi siempre "id"; los geográficos usan su propio nombre. */
function claveDe(f: FilaSat, llave?: string) {
  return (llave ? f[llave] : f.id) ?? "";
}

/**
 * Selector de un catálogo chico del SAT (tipos de permiso, configuraciones
 * vehiculares...). Busca en la lista ya cargada, sin ir al servidor.
 */
export function SelectTablaSat({
  tabla,
  value,
  onChange,
  filtrar,
  llave,
  placeholder = "Elige una opción",
  invalid,
}: {
  tabla: string;
  value: string;
  onChange: (id: string, fila: FilaSat | null) => void;
  /** Deja solo las filas que cumplen (p. ej. permisos del medio elegido). */
  filtrar?: (f: FilaSat) => boolean;
  /** Columna clave si no es "id" (SAT_GEO_ESTADOS usa "estado"). */
  llave?: string;
  placeholder?: string;
  invalid?: boolean;
}) {
  const filas = useTablaSat(tabla);
  const opciones = useMemo(
    () =>
      filas
        .filter((f) => !filtrar || filtrar(f))
        .map((f) => ({ ...f, id: claveDe(f, llave), texto: f.texto ?? claveDe(f, llave) })),
    [filas, filtrar, llave]
  );
  return (
    <SelectorCatalogoSat
      opciones={opciones}
      value={value}
      placeholder={filas.length === 0 ? "Cargando…" : placeholder}
      invalid={invalid}
      onChange={(o) => onChange(o.id, o)}
    />
  );
}

/**
 * Búsqueda en un catálogo grande del SAT (estaciones, materiales peligrosos,
 * municipios). Se puede dejar la clave escrita a mano.
 */
export function BuscadorTablaSat({
  tabla,
  value,
  texto,
  medio,
  onChange,
  placeholder = "Clave o nombre",
  invalid,
}: {
  tabla: string;
  value: string;
  /** Descripción de la clave elegida, para mostrarla debajo. */
  texto?: string;
  /** Filtra por medio de transporte (estaciones). */
  medio?: string;
  onChange: (id: string, fila: FilaSat | null) => void;
  placeholder?: string;
  invalid?: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [q, setQ] = useState("");
  // Resultados junto con la búsqueda que los produjo: "buscando" es que aún
  // no llegan los de lo que está escrito.
  const [respuesta, setRespuesta] = useState<{ q: string; filas: FilaSat[] }>({ q: "", filas: [] });
  const buscado = q.trim();
  const cargando = buscado.length >= 2 && respuesta.q !== buscado;
  const resultados = respuesta.q === buscado ? respuesta.filas : [];
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (caja.current && !caja.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  useEffect(() => {
    if (!abierto || buscado.length < 2) return;
    let vivo = true;
    const t = setTimeout(() => {
      buscarEnTablaSat(tabla, buscado, medio).then((filas) => {
        if (vivo) setRespuesta({ q: buscado, filas });
      });
    }, 300);
    return () => {
      vivo = false;
      clearTimeout(t);
    };
  }, [abierto, buscado, tabla, medio]);

  return (
    <div ref={caja} className="relative">
      <input
        className={cx(inputClass, "font-mono")}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        value={abierto ? q : value}
        onFocus={() => {
          setAbierto(true);
          setQ(value);
        }}
        onChange={(e) => {
          setQ(e.target.value);
          onChange(e.target.value.trim(), null);
        }}
      />
      {texto && !abierto && <p className="mt-1 truncate text-[11.5px] text-ink-3">{texto}</p>}
      {abierto && q.trim().length >= 2 && (
        <div className="absolute z-20 mt-1 max-h-64 w-full min-w-[280px] overflow-y-auto rounded-[10px] border border-line bg-surface shadow-lg">
          {cargando ? (
            <p className="px-3 py-2 text-[12.5px] text-ink-4">Buscando…</p>
          ) : resultados.length === 0 ? (
            <p className="px-3 py-2 text-[12.5px] text-ink-4">Sin resultados.</p>
          ) : (
            <ul className="divide-y divide-line-2">
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    className="focus-brand block w-full px-3 py-2 text-left text-[12.5px] hover:bg-surface-2"
                    onClick={() => {
                      onChange(r.id, r);
                      setAbierto(false);
                    }}
                  >
                    <span className="font-mono font-semibold text-ink">{r.id}</span>
                    <span className="text-ink-3"> - {r.texto}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Domicilio de carta porte (ubicaciones y figuras). En México, al escribir
 * los 5 dígitos del código postal se llenan estado, municipio y localidad, y
 * la colonia se elige de las del CP. En el extranjero todo es texto libre.
 */
export function DomicilioCP({
  valor,
  onChange,
  errores,
  mostrar,
}: {
  valor: Domicilio;
  onChange: (cambios: Partial<Domicilio>) => void;
  errores: ErroresCP;
  mostrar: boolean;
}) {
  const [info, setInfo] = useState<InfoCodigoPostal | null>(null);
  const [buscando, setBuscando] = useState(false);
  const mexico = valor.pais === "MEX";

  // Al abrir un registro guardado, recuperar colonias y textos de su CP.
  useEffect(() => {
    if (mexico && /^\d{5}$/.test(valor.codigopostal)) {
      consultarCp(valor.codigopostal).then(setInfo);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cambiarCp(cp: string) {
    onChange({ codigopostal: cp });
    if (!mexico || !/^\d{5}$/.test(cp)) {
      setInfo(null);
      return;
    }
    setBuscando(true);
    const r = await consultarCp(cp);
    setBuscando(false);
    setInfo(r);
    if (r?.codigoPostal) {
      onChange({
        codigopostal: cp,
        estado: r.codigoPostal.estado,
        municipio: r.codigoPostal.municipio ?? "",
        localidad: r.codigoPostal.localidad ?? "",
        colonia: r.colonias.length === 1 ? r.colonias[0].id : "",
      });
    }
  }

  const cpNoExiste = mexico && /^\d{5}$/.test(valor.codigopostal) && info !== null && !info.codigoPostal;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-6">
      <CampoCP label="País" nombre="pais" errores={errores} mostrar={mostrar} className="sm:col-span-2">
        <SelectTablaSat
          tabla="SAT_GEO_PAISES"
          value={valor.pais}
          onChange={(id) => onChange({ pais: id, estado: "", municipio: "", localidad: "", colonia: "" })}
          invalid={mostrar && !!errores.pais}
        />
      </CampoCP>
      <CampoCP
        label="Código postal"
        nombre="codigopostal"
        errores={errores}
        mostrar={mostrar}
        className="sm:col-span-2"
        hint={buscando ? "Buscando…" : cpNoExiste ? "Ese código postal no está en el catálogo del SAT" : mexico ? "Llena estado, municipio y colonia" : undefined}
      >
        <TextoCP
          value={valor.codigopostal}
          onChange={cambiarCp}
          inputMode={mexico ? "numeric" : undefined}
          maxLength={mexico ? 5 : 12}
          mono
          invalid={(mostrar && !!errores.codigopostal) || cpNoExiste}
        />
      </CampoCP>
      <CampoCP label="Estado" nombre="estado" errores={errores} mostrar={mostrar} className="sm:col-span-2">
        {mexico ? (
          <SelectTablaSat
            tabla="SAT_GEO_ESTADOS"
            llave="estado"
            filtrar={(f) => f.pais === "MEX"}
            value={valor.estado}
            onChange={(id) => onChange({ estado: id })}
            invalid={mostrar && !!errores.estado}
          />
        ) : (
          <TextoCP value={valor.estado} onChange={(v) => onChange({ estado: v })} invalid={mostrar && !!errores.estado} />
        )}
      </CampoCP>
      <CampoCP
        label="Municipio"
        nombre="municipio"
        errores={errores}
        mostrar={mostrar}
        className="sm:col-span-3"
        hint={mexico && info?.codigoPostal?.municipio_texto ? info.codigoPostal.municipio_texto : undefined}
      >
        <TextoCP value={valor.municipio} onChange={(v) => onChange({ municipio: v })} mono={mexico} placeholder={mexico ? "Clave del SAT" : ""} />
      </CampoCP>
      <CampoCP
        label="Colonia"
        nombre="colonia"
        errores={errores}
        mostrar={mostrar}
        className="sm:col-span-3"
      >
        {mexico && info && info.colonias.length > 0 ? (
          <SelectorCatalogoSat
            opciones={info.colonias}
            value={valor.colonia}
            placeholder="Elige la colonia"
            onChange={(o) => onChange({ colonia: o.id })}
          />
        ) : (
          <TextoCP value={valor.colonia} onChange={(v) => onChange({ colonia: v })} />
        )}
      </CampoCP>
      <CampoCP label="Calle" nombre="calle" errores={errores} mostrar={mostrar} className="sm:col-span-4">
        <TextoCP value={valor.calle} onChange={(v) => onChange({ calle: v })} />
      </CampoCP>
      <CampoCP label="No. exterior" nombre="numeroexterior" errores={errores} mostrar={mostrar} className="sm:col-span-1">
        <TextoCP value={valor.numeroexterior} onChange={(v) => onChange({ numeroexterior: v })} />
      </CampoCP>
      <CampoCP label="No. interior" nombre="numerointerior" errores={errores} mostrar={mostrar} className="sm:col-span-1">
        <TextoCP value={valor.numerointerior} onChange={(v) => onChange({ numerointerior: v })} />
      </CampoCP>
      <CampoCP label="Localidad" nombre="localidad" errores={errores} mostrar={mostrar} className="sm:col-span-2"
        hint={mexico && info?.codigoPostal?.localidad_texto ? info.codigoPostal.localidad_texto : undefined}>
        <TextoCP value={valor.localidad} onChange={(v) => onChange({ localidad: v })} mono={mexico} />
      </CampoCP>
      <CampoCP label="Referencia" nombre="referencia" errores={errores} mostrar={mostrar} className="sm:col-span-4">
        <TextoCP value={valor.referencia} onChange={(v) => onChange({ referencia: v })} placeholder="Entre calles, cómo llegar…" />
      </CampoCP>
    </div>
  );
}
