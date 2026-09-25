"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  ConfirmButton,
  EmptyState,
  Pill,
  RowActions,
  SearchInput,
  Segmented,
  Table,
  Td,
  Th,
  Toolbar,
  buttonClass,
  useToast,
} from "@/components/ui";
import { money } from "@/lib/cfdi";
import type { PrefacturaResumen } from "@/lib/prefacturas";

/*
   Prefacturas en la nube (mockup aprobado): las que se guardan aquí o en
   Factubox Escritorio, del emisor activo. Abrir sigue sobre la misma
   prefactura; Duplicar empieza una nueva con los mismos datos (otro IdCCP y
   sin fechas en la carta porte), para repetir un viaje.
*/

type Filtro = "todas" | "cartaporte" | "facturas";
const POR_PAGINA = 50;

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function fecha(f: string) {
  const [a, m, d] = f.split("-").map(Number);
  if (!a || !m || !d) return f;
  const hoy = new Date();
  return a === hoy.getFullYear() ? `${d} ${MESES[m - 1]}` : `${d} ${MESES[m - 1]} ${a}`;
}

function tipoDe(p: PrefacturaResumen): { texto: string; tono: "teal" | "neutral" } {
  if (p.EsCartaPorte) return { texto: p.TipoComprobante === "T" ? "Carta porte · traslado" : "Carta porte · ingreso", tono: "teal" };
  const nombres: Record<string, string> = { I: "Factura · ingreso", E: "Nota de crédito", P: "Complemento de pago", T: "Traslado" };
  return { texto: nombres[p.TipoComprobante] ?? p.TipoComprobante, tono: "neutral" };
}

export function PrefacturasSection({
  rfc,
  inicial,
}: {
  rfc: string;
  inicial: { total: number; prefacturas: PrefacturaResumen[] };
}) {
  const toast = useToast();
  const [datos, setDatos] = useState(inicial);
  const [filtro, setFiltro] = useState<Filtro>("todas");
  const [q, setQ] = useState("");
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [borrando, setBorrando] = useState<number | null>(null);
  const primera = useRef(true);

  const cargar = useCallback(
    async (f: Filtro, buscar: string, pag: number) => {
      setCargando(true);
      try {
        const params = new URLSearchParams({ rfc, filtro: f, q: buscar, pagina: String(pag) });
        const res = await fetch(`/api/prefacturas?${params}`);
        const body = await res.json();
        if (!res.ok) {
          toast(body.error ?? "No se pudieron consultar las prefacturas", "danger");
          return;
        }
        setDatos({ total: body.total ?? 0, prefacturas: body.prefacturas ?? [] });
      } finally {
        setCargando(false);
      }
    },
    [rfc, toast]
  );

  // La búsqueda espera a que se deje de teclear.
  useEffect(() => {
    if (primera.current) {
      primera.current = false;
      return;
    }
    const t = setTimeout(() => cargar(filtro, q.trim(), pagina), 300);
    return () => clearTimeout(t);
  }, [filtro, q, pagina, cargar]);

  async function eliminar(p: PrefacturaResumen) {
    setBorrando(p.Id);
    try {
      const res = await fetch(`/api/prefacturas/${p.Id}?rfc=${encodeURIComponent(rfc)}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) {
        toast(body.error ?? "No se pudo eliminar", "danger");
        return;
      }
      toast("Prefactura eliminada");
      await cargar(filtro, q.trim(), pagina);
    } finally {
      setBorrando(null);
    }
  }

  const paginas = Math.max(1, Math.ceil(datos.total / POR_PAGINA));
  const abrir = (p: PrefacturaResumen, duplicar = false) =>
    `/facturas/nueva?prefactura=${p.Id}&rfc=${encodeURIComponent(rfc)}${duplicar ? "&duplicar=1" : ""}`;

  return (
    <Card>
      <Toolbar>
        <Segmented<Filtro>
          ariaLabel="Qué prefacturas"
          value={filtro}
          onChange={(f) => {
            setFiltro(f);
            setPagina(1);
          }}
          options={[
            { value: "todas", label: "Todas" },
            { value: "cartaporte", label: "Carta porte" },
            { value: "facturas", label: "Facturas" },
          ]}
        />
        <SearchInput
          placeholder="Buscar por receptor, serie o folio…"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPagina(1);
          }}
        />
        <span className="ml-auto text-[12.5px] text-ink-3">
          {datos.total.toLocaleString("es-MX")} prefactura{datos.total === 1 ? "" : "s"}
        </span>
      </Toolbar>

      {datos.prefacturas.length === 0 ? (
        <EmptyState
          title={q.trim() || filtro !== "todas" ? "Nada coincide" : "Sin prefacturas en la nube"}
          description={
            q.trim() || filtro !== "todas"
              ? "Prueba con otro filtro o con otra palabra."
              : "Lo que empiezas a facturar aquí se guarda solo al cambiar de paso; lo que guardas en la nube desde el escritorio también aparece aquí."
          }
        />
      ) : (
        <div className={cargando ? "opacity-60 transition" : "transition"}>
          <Table>
            <thead>
              <tr>
                <Th>Receptor</Th>
                <Th>Tipo</Th>
                <Th>Detalle</Th>
                <Th>Guardada en</Th>
                <Th className="text-right">Total</Th>
                <Th>Fecha</Th>
                <Th className="w-56" />
              </tr>
            </thead>
            <tbody>
              {datos.prefacturas.map((p) => {
                const tipo = tipoDe(p);
                const soloEscritorio = p.TipoComprobante === "P";
                return (
                  <tr key={p.Id} className="group transition hover:bg-surface-2">
                    <Td>
                      <p className="font-semibold text-ink">{p.NombreReceptor || p.RFCReceptor || "Sin receptor"}</p>
                      <p className="font-mono text-[12px] text-ink-3">
                        {p.Serie || p.Folio ? `${p.Serie}${p.Serie && p.Folio ? "-" : ""}${p.Folio}` : p.Identificador}
                      </p>
                    </Td>
                    <Td>
                      <Pill tone={tipo.tono}>{tipo.texto}</Pill>
                    </Td>
                    <Td className="max-w-[260px] text-[12.5px] text-ink-2">{p.Detalles}</Td>
                    <Td>
                      <Pill tone={p.Origen === "Web" ? "violet" : "info"}>{p.Origen}</Pill>
                    </Td>
                    <Td className="text-right font-mono text-[13px]">
                      {p.TipoComprobante === "T" || p.TipoComprobante === "P" ? "—" : money(p.Total, p.Moneda || "MXN")}
                    </Td>
                    <Td className="whitespace-nowrap text-[12.5px] text-ink-2">{fecha(p.FechaReg)}</Td>
                    <Td>
                      <RowActions>
                        {soloEscritorio ? (
                          <span className="text-[12px] text-ink-3" title="Los complementos de pago guardados se abren en el escritorio">
                            Solo en escritorio
                          </span>
                        ) : (
                          <>
                            <Link href={abrir(p)} className={buttonClass("secondary", "sm")}>
                              Abrir
                            </Link>
                            <Link href={abrir(p, true)} className={buttonClass("ghost", "sm")}>
                              Duplicar
                            </Link>
                          </>
                        )}
                        <ConfirmButton pending={borrando === p.Id} onConfirm={() => eliminar(p)} />
                      </RowActions>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center gap-3 border-t border-line-2 px-4 py-3 text-[12px] text-ink-3">
          <span>
            {(pagina - 1) * POR_PAGINA + 1}–{Math.min(pagina * POR_PAGINA, datos.total)} de {datos.total.toLocaleString("es-MX")}
          </span>
          <span className="ml-auto flex gap-2">
            <Button size="sm" variant="ghost" disabled={pagina <= 1 || cargando} onClick={() => setPagina((x) => x - 1)}>
              Anterior
            </Button>
            <Button size="sm" variant="secondary" disabled={pagina >= paginas || cargando} onClick={() => setPagina((x) => x + 1)}>
              Siguiente
            </Button>
          </span>
        </div>
      )}
    </Card>
  );
}
