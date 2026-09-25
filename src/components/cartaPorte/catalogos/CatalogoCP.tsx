"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  RowActions,
  SearchInput,
  Table,
  Td,
  Th,
  Toolbar,
  useToast,
} from "@/components/ui";
import type { EntidadCP, PaginaCP, RegistroCP } from "@/lib/cartaPorteShared";

/*
   Listado de un catálogo de carta porte: búsqueda y paginación en el
   servidor (las mercancías pueden ser miles), borrar con confirmación, y
   el formulario propio de cada catálogo para crear y editar.
*/

const POR_PAGINA = 50;

export type FormularioCPProps<T extends RegistroCP> = {
  rfc: string;
  /** null = nuevo. */
  inicial: T | null;
  onCerrar: () => void;
  onGuardado: (registro: T) => void;
};

export function CatalogoCP<T extends RegistroCP>({
  rfc,
  entidad,
  inicial,
  titulo,
  descripcion,
  nuevo,
  vacio,
  encabezados,
  fila,
  nombreDe,
  Formulario,
  accionExtra,
}: {
  rfc: string;
  entidad: EntidadCP;
  inicial: PaginaCP<T>;
  titulo: string;
  descripcion: string;
  /** Texto del botón para crear ("Nuevo transporte"). */
  nuevo: string;
  vacio: { titulo: string; descripcion: string };
  encabezados: React.ReactNode[];
  /** Las celdas de un registro (sin la de acciones). */
  fila: (r: T) => React.ReactNode;
  /** Cómo se llama el registro en los avisos ("Kenworth T680"). */
  nombreDe: (r: T) => string;
  Formulario: React.ComponentType<FormularioCPProps<T>>;
  /** Otro botón junto al de crear (Importar desde Excel); recibe cómo recargar la lista. */
  accionExtra?: (recargar: () => void) => React.ReactNode;
}) {
  const toast = useToast();
  const [datos, setDatos] = useState<PaginaCP<T>>(inicial);
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [editando, setEditando] = useState<T | null | undefined>(undefined);
  const [borrando, setBorrando] = useState<number | null>(null);
  const primera = useRef(true);

  const cargar = useCallback(
    async (buscar: string, pag: number) => {
      setCargando(true);
      try {
        const params = new URLSearchParams({ q: buscar, pagina: String(pag), por: String(POR_PAGINA) });
        const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/carta-porte/${entidad}?${params}`);
        const body = await res.json();
        if (!res.ok) {
          toast(body.error ?? "No se pudo consultar el catálogo", "danger");
          return;
        }
        setDatos(body as PaginaCP<T>);
      } finally {
        setCargando(false);
      }
    },
    [rfc, entidad, toast]
  );

  // La búsqueda espera a que se deje de teclear.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => cargar(q.trim(), pagina), 300);
    return () => clearTimeout(t);
  }, [q, pagina, cargar]);

  async function eliminar(r: T) {
    if (!r.id) return;
    setBorrando(r.id);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/carta-porte/${entidad}/${r.id}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo eliminar", "danger");
        return;
      }
      toast(`${nombreDe(r)} eliminado`);
      await cargar(q.trim(), pagina);
    } finally {
      setBorrando(null);
    }
  }

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={titulo}
          description={descripcion}
          action={
            <div className="flex flex-wrap gap-2">
              {accionExtra?.(() => cargar(q.trim(), pagina))}
              <Button variant="primary" onClick={() => setEditando(null)}>
                {nuevo}
              </Button>
            </div>
          }
        />
        <Toolbar>
          <SearchInput
            placeholder="Buscar…"
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
          />
        </Toolbar>

        {datos.registros.length === 0 ? (
          <EmptyState
            title={q.trim() ? "Nada coincide con la búsqueda" : vacio.titulo}
            description={q.trim() ? "Prueba con otra palabra o clave." : vacio.descripcion}
            action={
              q.trim() ? undefined : (
                <Button variant="primary" onClick={() => setEditando(null)}>
                  {nuevo}
                </Button>
              )
            }
          />
        ) : (
          <div className={cargando ? "opacity-60 transition" : "transition"}>
            <Table>
              <thead>
                <tr>
                  {encabezados.map((h, i) => (
                    <Th key={i}>{h}</Th>
                  ))}
                  <Th className="w-36" />
                </tr>
              </thead>
              <tbody>
                {datos.registros.map((r) => (
                  <tr key={r.id} className="group cursor-pointer transition hover:bg-surface-2" onClick={() => setEditando(r)}>
                    {fila(r)}
                    <Td>
                      <span onClick={(e) => e.stopPropagation()}>
                        <RowActions>
                          <Button size="sm" variant="ghost" onClick={() => setEditando(r)}>
                            Editar
                          </Button>
                          <ConfirmButton pending={borrando === r.id} onConfirm={() => eliminar(r)} />
                        </RowActions>
                      </span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        )}

        <CardBody className="flex items-center gap-3 border-t border-line-2 py-3 text-[12px] text-ink-3">
          <span>
            {datos.total === 0
              ? "Sin registros"
              : `${(pagina - 1) * POR_PAGINA + 1}–${Math.min(pagina * POR_PAGINA, datos.total)} de ${datos.total.toLocaleString("es-MX")}`}
          </span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" disabled={pagina <= 1 || cargando} onClick={() => setPagina((p) => p - 1)}>
              Anterior
            </Button>
            <Button size="sm" variant="secondary" disabled={pagina >= paginas || cargando} onClick={() => setPagina((p) => p + 1)}>
              Siguiente
            </Button>
          </span>
        </CardBody>
      </Card>

      <p className="px-1 text-[12px] text-ink-4">
        Se guardan en la nube con los mismos campos que usa Factubox Escritorio Carta Porte.
      </p>

      {editando !== undefined && (
        <Formulario
          rfc={rfc}
          inicial={editando}
          onCerrar={() => setEditando(undefined)}
          onGuardado={(r) => {
            toast(editando ? `${nombreDe(r)} guardado` : `${nombreDe(r)} agregado`);
            setEditando(undefined);
            cargar(q.trim(), pagina);
          }}
        />
      )}
    </div>
  );
}

/** Guarda un registro por el BFF; devuelve el registro o el mensaje de error. */
export async function guardarCP<T extends RegistroCP>(
  rfc: string,
  entidad: EntidadCP,
  registro: T
): Promise<{ ok: true; registro: T } | { ok: false; error: string }> {
  try {
    const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/carta-porte/${entidad}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registro),
    });
    const body = await res.json();
    if (!res.ok) return { ok: false, error: body.error ?? "No se pudo guardar" };
    return { ok: true, registro: body.registro as T };
  } catch {
    return { ok: false, error: "No se pudo conectar con el servidor" };
  }
}
