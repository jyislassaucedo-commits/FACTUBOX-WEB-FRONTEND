"use client";

import Link from "next/link";
import { useState } from "react";
import { Pill, buttonClass, cx } from "@/components/ui";
import type { ResultadoRegimenFiscal } from "@/lib/catalogoSatBusquedaShared";
import { useCatalogoSat } from "@/lib/useCatalogoSat";
import { diasRestantes, emisorHref, formatoFecha } from "@/lib/emisorNav";
import type { EmisorSectionKey } from "@/lib/emisorNav";

export type HeroKpi = {
  label: string;
  value: string;
  meta: string;
  section: EmisorSectionKey;
  segment: string;
  tone?: "ok" | "warn" | "danger";
};

export function EmisorHero({
  rfc,
  nombre,
  regimen,
  lugarExp,
  logoBase64,
  vigenciaCert,
  tieneCsd,
  kpis,
}: {
  rfc: string;
  nombre: string;
  regimen: string;
  lugarExp: string;
  logoBase64?: string;
  vigenciaCert: string;
  tieneCsd: boolean;
  kpis: HeroKpi[];
}) {
  const [copiado, setCopiado] = useState(false);
  const regimenes = useCatalogoSat<ResultadoRegimenFiscal>("regimenFiscal");
  const regimenEncontrado = regimenes.find((r) => r.id === regimen);
  const regimenLabel = regimenEncontrado
    ? `${regimenEncontrado.id} - ${regimenEncontrado.texto}`
    : `Régimen ${regimen}`;
  // "601 - General de Ley Personas Morales" -> "601 · General de Ley Personas Morales"
  const regimenCorto = regimenLabel.replace(" - ", " · ");
  const dias = tieneCsd ? diasRestantes(vigenciaCert) : null;

  async function copiarRfc() {
    try {
      await navigator.clipboard.writeText(rfc);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1600);
    } catch {
      /* el portapapeles puede estar bloqueado; no vale la pena molestar */
    }
  }

  return (
    <section className="relative mb-5 overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-raised">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-20 h-60 w-60 rounded-full bg-brand-050"
      />
      <div className="relative flex flex-wrap items-start gap-4">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-2xl border border-line bg-surface-2 text-[10px] text-ink-4">
          {logoBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:image/png;base64,${logoBase64}`}
              alt=""
              className="h-full w-full object-contain p-1"
            />
          ) : (
            "LOGO"
          )}
        </span>

        <div className="min-w-[240px] flex-1">
          <h1 className="text-xl font-bold tracking-tight text-ink">{nombre}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copiarRfc}
              className="focus-brand inline-flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-2.5 py-1 font-mono text-xs font-semibold text-ink transition hover:border-brand hover:text-brand"
              title="Copiar RFC"
            >
              {rfc}
              <span className="text-[10px] font-sans text-ink-3">
                {copiado ? "copiado" : "⧉"}
              </span>
            </button>
            <Pill title={regimenLabel}>{regimenCorto}</Pill>
            <Pill>CP {lugarExp}</Pill>
            {tieneCsd ? (
              <Pill tone={dias !== null && dias < 30 ? "warn" : "ok"}>
                ● CSD vigente
                {dias !== null && dias >= 0 && ` · ${dias} días`}
              </Pill>
            ) : (
              <Pill tone="danger">● Sin CSD</Pill>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link href={emisorHref(rfc, "disenos")} className={buttonClass("secondary")}>
            Diseños del PDF
          </Link>
          <Link href="/facturas/nueva" className={buttonClass("primary")}>
            Nueva factura
          </Link>
        </div>
      </div>

      <div className="relative mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link
            key={kpi.section}
            href={emisorHref(rfc, kpi.segment)}
            className="focus-brand rounded-xl border border-line bg-surface-2 px-3.5 py-3 transition hover:-translate-y-0.5 hover:border-ink-4 hover:shadow-raised"
          >
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-3">
              {kpi.label}
            </p>
            <p
              className={cx(
                "mt-1.5 text-2xl font-bold leading-none tracking-tight",
                kpi.tone === "ok"
                  ? "text-ok"
                  : kpi.tone === "warn"
                    ? "text-warn"
                    : kpi.tone === "danger"
                      ? "text-danger"
                      : "text-ink"
              )}
            >
              {kpi.value}
            </p>
            <p className="mt-1.5 text-[11.5px] text-ink-3">{kpi.meta}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export { formatoFecha };
