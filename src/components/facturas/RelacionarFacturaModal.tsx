"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  EmptyState,
  Field,
  FieldError,
  Input,
  Modal,
  Note,
  Pill,
  SearchInput,
  Segmented,
} from "@/components/ui";
import { fechaHora, money } from "@/lib/cfdi";
import type { Factura } from "@/lib/facturasShared";

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Elige la factura que una nota de crédito va a corregir.
 *
 * Dos caminos a propósito: buscarla en el listado (lo cómodo cuando es
 * reciente) o pegar el folio fiscal a mano (lo único posible cuando la factura
 * es vieja, se emitió desde otro sistema o cae fuera del rango consultado).
 */
export function RelacionarFacturaModal({
  rfcEmisor,
  yaRelacionados,
  onClose,
  onAgregar,
}: {
  rfcEmisor: string;
  yaRelacionados: string[];
  onClose: () => void;
  onAgregar: (uuids: string[]) => void;
}) {
  const [modo, setModo] = useState<"buscar" | "uuid">("buscar");

  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth() - 3, 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [q, setQ] = useState("");
  const [seleccion, setSeleccion] = useState<string[]>([]);

  /**
   * Resultado cacheado junto con la "clave" de la consulta que lo produjo.
   * Derivar `cargando` de comparar la clave pedida contra la clave cargada
   * evita un setState síncrono dentro del efecto (regla
   * react-hooks/set-state-in-effect de esta versión de Next).
   */
  const clave = `${rfcEmisor}|${desde}|${hasta}`;
  const [cache, setCache] = useState<{
    clave: string;
    facturas: Factura[];
    error: string | null;
  } | null>(null);

  const vigente = cache?.clave === clave ? cache : null;
  const cargando = modo === "buscar" && !vigente;
  const errorCarga = vigente?.error ?? null;

  const [uuidManual, setUuidManual] = useState("");
  const errorUuid =
    uuidManual.trim() === ""
      ? null
      : !UUID_RE.test(uuidManual.trim())
        ? "El folio fiscal tiene 36 caracteres con guiones."
        : yaRelacionados.includes(uuidManual.trim().toUpperCase())
          ? "Ese CFDI ya está relacionado."
          : null;

  useEffect(() => {
    if (modo !== "buscar") return;
    let vivo = true;

    const params = new URLSearchParams({
      emisor: rfcEmisor,
      tipo: "I",
      estatus: "Vigente",
      desde,
      hasta,
    });

    fetch(`/api/facturas/buscar?${params.toString()}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "No se pudo buscar");
        return body as { facturas: Factura[] };
      })
      .then(
        (body) => vivo && setCache({ clave, facturas: body.facturas, error: null })
      )
      .catch((e: unknown) => {
        if (!vivo) return;
        setCache({
          clave,
          facturas: [],
          error: e instanceof Error ? e.message : "Error al buscar facturas",
        });
      });

    return () => {
      vivo = false;
    };
  }, [modo, clave, rfcEmisor, desde, hasta]);

  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (vigente?.facturas ?? []).filter(
      (f) =>
        !yaRelacionados.includes(f.Uuid.toUpperCase()) &&
        (!query ||
          `${f.Serie}-${f.Folio} ${f.NombreReceptor} ${f.RfcReceptor} ${f.Uuid}`
            .toLowerCase()
            .includes(query))
    );
  }, [vigente, q, yaRelacionados]);

  function alternar(uuid: string) {
    setSeleccion((prev) =>
      prev.includes(uuid) ? prev.filter((u) => u !== uuid) : [...prev, uuid]
    );
  }

  return (
    <Modal
      wide
      title="Relacionar la factura que corrige"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          {modo === "buscar" ? (
            <Button
              variant="primary"
              disabled={seleccion.length === 0}
              onClick={() => {
                onAgregar(seleccion);
                onClose();
              }}
            >
              {seleccion.length > 0
                ? `Relacionar ${seleccion.length} factura${seleccion.length === 1 ? "" : "s"}`
                : "Relacionar"}
            </Button>
          ) : (
            <Button
              variant="primary"
              disabled={!UUID_RE.test(uuidManual.trim()) || Boolean(errorUuid)}
              onClick={() => {
                onAgregar([uuidManual.trim().toUpperCase()]);
                onClose();
              }}
            >
              Relacionar este folio
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        <Segmented
          ariaLabel="Cómo relacionar la factura"
          value={modo}
          onChange={setModo}
          options={[
            { value: "buscar", label: "Buscar en mis facturas" },
            { value: "uuid", label: "Pegar folio fiscal" },
          ]}
        />

        {modo === "uuid" ? (
          <div className="space-y-3">
            <Note tone="info">
              Úsalo cuando la factura sea antigua, venga de otro sistema o no
              aparezca en la búsqueda. El folio fiscal (UUID) viene en el PDF y en
              el XML del comprobante original.
            </Note>
            <Field
              label="Folio fiscal (UUID) de la factura original"
              hint="36 caracteres, con guiones."
            >
              <Input
                className="font-mono"
                autoFocus
                placeholder="00000000-0000-0000-0000-000000000000"
                value={uuidManual}
                onChange={(e) => setUuidManual(e.target.value)}
                aria-invalid={Boolean(errorUuid)}
              />
              <FieldError mensaje={errorUuid} />
            </Field>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="rel-desde">
                Del
              </label>
              <input
                id="rel-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="focus-brand rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
              <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="rel-hasta">
                al
              </label>
              <input
                id="rel-hasta"
                type="date"
                value={hasta}
                onChange={(e) => setHasta(e.target.value)}
                className="focus-brand rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
            </div>

            <SearchInput
              placeholder="Buscar por folio, receptor o UUID…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />

            {errorCarga && <Note tone="danger">{errorCarga}</Note>}

            <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-line">
              {cargando ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2].map((i) => (
                    <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
                  ))}
                </div>
              ) : filtradas.length === 0 ? (
                <EmptyState
                  title="No hay facturas de ingreso vigentes en el rango"
                  description="Amplía las fechas, o pega el folio fiscal a mano en la otra pestaña."
                />
              ) : (
                <ul className="divide-y divide-line-2">
                  {filtradas.map((f) => {
                    const activa = seleccion.includes(f.Uuid);
                    return (
                      <li key={f.Uuid}>
                        <button
                          type="button"
                          onClick={() => alternar(f.Uuid)}
                          aria-pressed={activa}
                          className={`focus-brand flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition ${
                            activa ? "bg-brand-050" : "hover:bg-surface-2"
                          }`}
                        >
                          <span
                            className={`grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px] ${
                              activa
                                ? "border-brand bg-brand text-brand-ink"
                                : "border-line bg-surface"
                            }`}
                            aria-hidden
                          >
                            {activa ? "✓" : ""}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="font-mono text-[13px] font-semibold text-ink">
                                {f.Serie ? `${f.Serie}-${f.Folio}` : f.Folio}
                              </span>
                              <Pill tone="ok">{f.EstatusSat}</Pill>
                            </span>
                            <span className="mt-0.5 block truncate text-[12px] text-ink-3">
                              {f.NombreReceptor} · {fechaHora(f.FechaEmision || f.FechaReg)}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-[13px] font-semibold text-ink">
                            {money(f.Total, f.Moneda)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
