"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  ConfirmButton,
  EmptyState,
  Field,
  Input,
  Modal,
  Note,
  Pill,
  RowActions,
  SearchInput,
  Segmented,
  Select,
  Table,
  Td,
  Th,
  Toolbar,
  useToast,
} from "@/components/ui";
import { tipoSerie } from "@/lib/emisorNav";
import { TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import type { Serie } from "@/lib/series";

type Filtro = "all" | string;

const NUEVA_VACIA = { nombre: "", tipo: "I", inicio: "1" };

export function SeriesSection({ rfc, series }: { rfc: string; series: Serie[] }) {
  const router = useRouter();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("all");
  const [modalAbierto, setModalAbierto] = useState(false);
  const [nueva, setNueva] = useState(NUEVA_VACIA);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [borrando, setBorrando] = useState<string | null>(null);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return series.filter(
      (s) =>
        (filtro === "all" || s.Tipo === filtro) &&
        (!query || s.Nombre.toLowerCase().includes(query))
    );
  }, [series, q, filtro]);

  const conteoPorTipo = useMemo(
    () =>
      TIPO_ORDEN.map((tipo) => ({
        tipo,
        label: TIPO_LABELS[tipo],
        total: series.filter((s) => s.Tipo === tipo).length,
      })),
    [series]
  );

  const invalidas = series.filter((s) => !tipoSerie(s.Tipo).valido);

  async function handleAgregar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!nueva.nombre.trim() || !nueva.inicio) {
      setError("Escribe el nombre de la serie y el folio inicial.");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/series`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nueva),
      });
      const body = await res.json();

      if (!res.ok) {
        setError(body.error ?? "No se pudo crear la serie");
        return;
      }

      setNueva(NUEVA_VACIA);
      setModalAbierto(false);
      toast("Serie agregada");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleEliminar(serie: Serie) {
    const clave = `${serie.Tipo}-${serie.Nombre}`;
    setBorrando(clave);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/series`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: serie.Nombre, tipo: serie.Tipo }),
      });
      const body = await res.json();

      if (!res.ok) {
        toast(body.error ?? "No se pudo eliminar la serie", "danger");
        return;
      }
      toast("Serie eliminada");
      router.refresh();
    } finally {
      setBorrando(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {conteoPorTipo.map((t) => (
          <button
            key={t.tipo}
            type="button"
            onClick={() => setFiltro(filtro === t.tipo ? "all" : t.tipo)}
            className={`focus-brand rounded-xl border px-3.5 py-3 text-left transition ${
              filtro === t.tipo
                ? "border-brand bg-brand-050"
                : "border-line bg-surface hover:border-ink-4"
            }`}
          >
            <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {t.label}
            </span>
            <span className="mt-1 block text-2xl font-bold leading-none tracking-tight text-ink">
              {t.total}
            </span>
            <span className="mt-1 block text-[11.5px] text-ink-3">
              {t.total === 1 ? "serie" : "series"}
            </span>
          </button>
        ))}
      </div>

      {invalidas.length > 0 && (
        <Note tone="warn" title={`${invalidas.length} serie(s) con tipo de comprobante inválido`}>
          {invalidas.map((s) => `${s.Nombre || "(sin nombre)"} → "${s.Tipo}"`).join(", ")}. El
          SAT solo acepta I (Ingreso), E (Egreso), N (Nómina), P (Pago) y T (Traslado);
          conviene borrarlas y volverlas a crear con el tipo correcto.
        </Note>
      )}

      <Card>
        <CardHeader
          title="Series y folios"
          description="Cada serie lleva su propio consecutivo de folio, según el tipo de comprobante."
          action={
            <Button variant="primary" onClick={() => setModalAbierto(true)}>
              Agregar serie
            </Button>
          }
        />

        <Toolbar>
          <SearchInput
            placeholder="Buscar serie…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Segmented
            ariaLabel="Filtrar por tipo de comprobante"
            value={filtro}
            onChange={setFiltro}
            options={[
              { value: "all", label: "Todas" },
              ...TIPO_ORDEN.map((tipo) => ({ value: tipo, label: TIPO_LABELS[tipo] })),
            ]}
          />
        </Toolbar>

        {filtradas.length === 0 ? (
          <EmptyState
            title={series.length === 0 ? "Sin series todavía" : "Ninguna serie coincide"}
            description={
              series.length === 0
                ? "Necesitas al menos una serie para poder emitir facturas."
                : "Prueba con otro texto o quita el filtro de tipo."
            }
            action={
              series.length === 0 ? (
                <Button variant="primary" onClick={() => setModalAbierto(true)}>
                  Agregar la primera serie
                </Button>
              ) : undefined
            }
          />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Serie</Th>
                <Th>Tipo</Th>
                <Th>Folio inicial</Th>
                <Th className="w-28" />
              </tr>
            </thead>
            <tbody>
              {filtradas.map((serie) => {
                const info = tipoSerie(serie.Tipo);
                const clave = `${serie.Tipo}-${serie.Nombre}`;
                const nombreRaro = !/^[A-Za-z0-9]+$/.test(serie.Nombre.trim());
                return (
                  <tr key={clave} className="group transition hover:bg-surface-2">
                    <Td>
                      <span
                        className={`font-mono text-[13.5px] font-semibold ${
                          nombreRaro ? "text-warn" : "text-ink"
                        }`}
                      >
                        {serie.Nombre.trim() || "(sin nombre)"}
                      </span>
                    </Td>
                    <Td>
                      <Pill tone={info.tone} title={info.valido ? undefined : "Tipo no reconocido por el SAT"}>
                        {info.valido ? info.label : `⚠ ${info.label}`}
                      </Pill>
                    </Td>
                    <Td className="font-mono">{serie.Inicio}</Td>
                    <Td>
                      <RowActions>
                        <ConfirmButton
                          pending={borrando === clave}
                          onConfirm={() => handleEliminar(serie)}
                        />
                      </RowActions>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}

        <CardBody className="border-t border-line-2 py-3 text-[12px] text-ink-3">
          Mostrando {filtradas.length} de {series.length} series.
        </CardBody>
      </Card>

      {modalAbierto && (
        <Modal
          title="Agregar serie"
          onClose={() => setModalAbierto(false)}
          footer={
            <>
              <Button variant="ghost" onClick={() => setModalAbierto(false)}>
                Cancelar
              </Button>
              <Button variant="primary" form="form-nueva-serie" type="submit" disabled={saving}>
                {saving ? "Agregando…" : "Agregar serie"}
              </Button>
            </>
          }
        >
          <form id="form-nueva-serie" onSubmit={handleAgregar} className="grid gap-4 sm:grid-cols-2">
            <Field label="Serie" hint="Solo letras y números.">
              <Input
                className="font-mono"
                placeholder="A"
                maxLength={25}
                autoFocus
                value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
              />
            </Field>
            <Field label="Tipo de comprobante">
              <Select
                value={nueva.tipo}
                onChange={(e) => setNueva({ ...nueva, tipo: e.target.value })}
              >
                {TIPO_ORDEN.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {TIPO_LABELS[tipo]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Folio inicial"
              hint="El siguiente CFDI de esta serie usará este folio."
              className="sm:col-span-2"
            >
              <Input
                type="number"
                min={1}
                className="font-mono"
                value={nueva.inicio}
                onChange={(e) => setNueva({ ...nueva, inicio: e.target.value })}
              />
            </Field>
            {error && (
              <div className="sm:col-span-2">
                <Note tone="danger">{error}</Note>
              </div>
            )}
          </form>
        </Modal>
      )}
    </div>
  );
}
