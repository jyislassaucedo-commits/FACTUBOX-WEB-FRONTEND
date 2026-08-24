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
 * Elige la factura PPD que un complemento de pago va a saldar (total o
 * parcialmente).
 *
 * Mismo patrón de dos caminos que RelacionarFacturaModal (buscar en el
 * listado / pegar el folio fiscal), pero de una sola selección: un pago de
 * este asistente siempre salda un único documento.
 */
export function ElegirFacturaOrigenModal({
  rfcEmisor,
  onClose,
  onElegir,
}: {
  rfcEmisor: string;
  onClose: () => void;
  onElegir: (uuid: string) => void;
}) {
  const [modo, setModo] = useState<"buscar" | "uuid">("buscar");

  const hoy = new Date();
  const [desde, setDesde] = useState(iso(new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1)));
  const [hasta, setHasta] = useState(iso(hoy));
  const [q, setQ] = useState("");

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
  const [buscandoUuid, setBuscandoUuid] = useState(false);
  const [errorUuidManual, setErrorUuidManual] = useState<string | null>(null);
  const errorFormatoUuid =
    uuidManual.trim() === "" || UUID_RE.test(uuidManual.trim())
      ? null
      : "El folio fiscal tiene 36 caracteres con guiones.";

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

  // Solo facturas PPD: son las únicas que un complemento de pago puede saldar.
  const filtradas = useMemo(() => {
    const query = q.trim().toLowerCase();
    return (vigente?.facturas ?? []).filter(
      (f) =>
        f.MetodoPago === "PPD" &&
        (!query ||
          `${f.Serie}-${f.Folio} ${f.NombreReceptor} ${f.RfcReceptor} ${f.Uuid}`
            .toLowerCase()
            .includes(query))
    );
  }, [vigente, q]);

  async function elegirPorUuid() {
    const uuid = uuidManual.trim().toUpperCase();
    if (!UUID_RE.test(uuid)) return;
    setBuscandoUuid(true);
    setErrorUuidManual(null);
    try {
      const params = new URLSearchParams({
        emisor: rfcEmisor,
        tipo: "I",
        estatus: "TODO",
        desde: "2000-01-01",
        hasta: iso(hoy),
      });
      const res = await fetch(`/api/facturas/buscar?${params.toString()}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No se pudo buscar");
      const factura = (body.facturas as Factura[]).find((f) => f.Uuid.toUpperCase() === uuid);
      if (!factura) {
        setErrorUuidManual("No se encontró esa factura entre las de este emisor.");
        return;
      }
      if (factura.MetodoPago !== "PPD") {
        setErrorUuidManual("Esa factura no es PPD: no se le puede aplicar un complemento de pago.");
        return;
      }
      if (factura.EstatusSat === "Cancelado") {
        setErrorUuidManual("Esa factura está cancelada.");
        return;
      }
      onElegir(factura.Uuid);
      onClose();
    } catch (e) {
      setErrorUuidManual(e instanceof Error ? e.message : "Error al buscar la factura");
    } finally {
      setBuscandoUuid(false);
    }
  }

  return (
    <Modal wide title="Elegir la factura a pagar" onClose={onClose}>
      <div className="space-y-4">
        <Segmented
          ariaLabel="Cómo elegir la factura"
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
              Úsalo cuando la factura sea antigua o no aparezca en la búsqueda.
              El folio fiscal (UUID) viene en el PDF y en el XML del
              comprobante original.
            </Note>
            <Field
              label="Folio fiscal (UUID) de la factura a pagar"
              hint="36 caracteres, con guiones."
            >
              <Input
                className="font-mono"
                autoFocus
                placeholder="00000000-0000-0000-0000-000000000000"
                value={uuidManual}
                onChange={(e) => {
                  setUuidManual(e.target.value);
                  setErrorUuidManual(null);
                }}
                aria-invalid={Boolean(errorFormatoUuid || errorUuidManual)}
              />
              <FieldError mensaje={errorFormatoUuid ?? errorUuidManual ?? undefined} />
            </Field>
            <Button
              variant="primary"
              disabled={!UUID_RE.test(uuidManual.trim()) || buscandoUuid}
              onClick={elegirPorUuid}
            >
              {buscandoUuid ? "Buscando…" : "Usar esta factura"}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="origen-desde">
                Del
              </label>
              <input
                id="origen-desde"
                type="date"
                value={desde}
                onChange={(e) => setDesde(e.target.value)}
                className="focus-brand rounded-[10px] border border-line bg-surface px-2.5 py-1.5 text-[13px] text-ink"
              />
              <label className="text-[11.5px] font-semibold text-ink-2" htmlFor="origen-hasta">
                al
              </label>
              <input
                id="origen-hasta"
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
                  title="No hay facturas PPD vigentes en el rango"
                  description="Solo las facturas con método de pago PPD se pueden saldar con un complemento de pago. Amplía las fechas, o pega el folio fiscal a mano en la otra pestaña."
                />
              ) : (
                <ul className="divide-y divide-line-2">
                  {filtradas.map((f) => (
                    <li key={f.Uuid}>
                      <button
                        type="button"
                        onClick={() => {
                          onElegir(f.Uuid);
                          onClose();
                        }}
                        className="focus-brand flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition hover:bg-surface-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="font-mono text-[13px] font-semibold text-ink">
                              {f.Serie ? `${f.Serie}-${f.Folio}` : f.Folio}
                            </span>
                            <Pill tone="ok">{f.EstatusSat}</Pill>
                            <Pill tone="info">PPD</Pill>
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
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
