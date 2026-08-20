import Link from "next/link";
import { Card, CardBody, CardHeader, Note, Pill, ProgressBar } from "@/components/ui";
import { buttonClass, cx } from "@/components/ui/styles";
import { loadEmisorContext } from "@/lib/emisorData";
import {
  diasRestantes,
  emisorHref,
  formatoFecha,
  tipoSerie,
} from "@/lib/emisorNav";
import { TIPO_LABELS, TIPO_ORDEN } from "@/lib/reportesUtils";
import { EstatusEmisorCard } from "@/components/emisores/EstatusEmisorCard";

export default async function EmisorResumenPage({
  params,
}: {
  params: Promise<{ rfc: string }>;
}) {
  const { rfc: rfcParam } = await params;
  const rfc = decodeURIComponent(rfcParam);
  const contexto = await loadEmisorContext(rfc);

  // El layout ya muestra el mensaje de "no encontrado"; aqui solo evitamos
  // renderizar con datos nulos.
  if (!contexto) return null;

  const { emisor, series, receptores, configs, tieneCsd } = contexto;
  const dias = tieneCsd ? diasRestantes(emisor.VigenciaCert) : null;

  const checklist = [
    {
      ok: Boolean(emisor.Nombre && emisor.Regimen && emisor.LugarExp),
      titulo: "Datos fiscales completos",
      detalle: `Razón social, régimen ${emisor.Regimen} y CP ${emisor.LugarExp}.`,
      href: emisorHref(rfc, "datos"),
      cta: "Revisar datos",
    },
    {
      ok: tieneCsd,
      titulo: "Certificado de sello digital cargado",
      detalle: tieneCsd
        ? `Vigente hasta ${formatoFecha(emisor.VigenciaCert)}.`
        : "Sin CSD no puedes timbrar ninguna factura.",
      href: emisorHref(rfc, "csd"),
      cta: "Subir CSD",
    },
    {
      ok: series.length > 0,
      titulo: "Series y folios configurados",
      detalle:
        series.length > 0
          ? `${series.length} series registradas.`
          : "Necesitas al menos una serie para emitir.",
      href: emisorHref(rfc, "series"),
      cta: "Agregar serie",
    },
    {
      ok: receptores.length > 0,
      titulo: "Receptores frecuentes",
      detalle:
        receptores.length > 0
          ? `${receptores.length} clientes listos para seleccionar al facturar.`
          : "Agrega clientes para no capturarlos cada vez.",
      href: emisorHref(rfc, "receptores"),
      cta: "Agregar receptor",
    },
    {
      ok: configs.length > 0,
      titulo: "Diseño del PDF",
      detalle:
        configs.length > 0
          ? `${configs.length} plantillas guardadas.`
          : "Sin plantilla, el PDF sale con el diseño base.",
      href: emisorHref(rfc, "disenos"),
      cta: "Crear diseño",
    },
    {
      ok: Boolean(emisor.Logo),
      titulo: "Logotipo del emisor",
      detalle: emisor.Logo
        ? `Cargado (${emisor.NombreLogo || "sin nombre"}).`
        : "El PDF saldrá sin logotipo.",
      href: emisorHref(rfc, "datos"),
      cta: "Subir logo",
    },
  ];

  const listos = checklist.filter((c) => c.ok).length;

  // --- Higiene de catalogos: cosas reales detectadas en los datos ----------
  const seriesTipoInvalido = series.filter((s) => !tipoSerie(s.Tipo).valido);
  const seriesNombreRaro = series.filter((s) => !/^[A-Za-z0-9]+$/.test(s.Nombre.trim()));
  const receptoresSinRfc = receptores.filter((r) => !r.Rfc?.trim());
  const nombresRepetidos = Object.entries(
    receptores.reduce<Record<string, number>>((acc, r) => {
      const clave = r.Nombre.trim().toUpperCase();
      if (clave) acc[clave] = (acc[clave] ?? 0) + 1;
      return acc;
    }, {})
  ).filter(([, n]) => n > 1);

  const hallazgos = [
    seriesTipoInvalido.length > 0 && {
      tone: "warn" as const,
      titulo: `${seriesTipoInvalido.length} serie(s) con tipo de comprobante inválido`,
      texto: `${seriesTipoInvalido
        .map((s) => `${s.Nombre || "(sin nombre)"} → "${s.Tipo}"`)
        .join(", ")}. El SAT solo acepta I, E, N, P y T.`,
      href: emisorHref(rfc, "series"),
    },
    seriesNombreRaro.length > 0 && {
      tone: "warn" as const,
      titulo: `${seriesNombreRaro.length} serie(s) con nombre no alfanumérico`,
      texto: `${seriesNombreRaro
        .map((s) => `"${s.Nombre}"`)
        .join(", ")}. Se imprime tal cual en el CFDI.`,
      href: emisorHref(rfc, "series"),
    },
    receptoresSinRfc.length > 0 && {
      tone: "warn" as const,
      titulo: `${receptoresSinRfc.length} receptor(es) sin RFC`,
      texto: `${receptoresSinRfc.map((r) => r.Nombre).join(", ")}. No se pueden usar para timbrar.`,
      href: emisorHref(rfc, "receptores"),
    },
    nombresRepetidos.length > 0 && {
      tone: "info" as const,
      titulo: `${nombresRepetidos.length} nombre(s) de receptor repetidos`,
      texto: `${nombresRepetidos.map(([nombre]) => nombre).join(", ")}. Puede ser un duplicado.`,
      href: emisorHref(rfc, "receptores"),
    },
  ].filter(Boolean) as Array<{
    tone: "warn" | "info";
    titulo: string;
    texto: string;
    href: string;
  }>;

  const porTipo = TIPO_ORDEN.map((tipo) => ({
    tipo,
    label: TIPO_LABELS[tipo],
    total: series.filter((s) => s.Tipo === tipo).length,
  })).filter((t) => t.total > 0);

  const folioMasAlto = series.reduce(
    (max, s) => Math.max(max, parseInt(s.Inicio, 10) || 0),
    0
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
      <div className="space-y-4">
        <Card>
          <CardHeader
            title="Configuración del emisor"
            description="Lo que falta para poder timbrar sin fricción."
            action={
              <Pill tone={listos === checklist.length ? "ok" : "warn"}>
                {listos} de {checklist.length} listo
              </Pill>
            }
          />
          <CardBody>
            <div className="mb-4">
              <ProgressBar
                value={(listos / checklist.length) * 100}
                tone={listos === checklist.length ? "ok" : "brand"}
              />
            </div>
            <ul className="space-y-2">
              {checklist.map((item) => (
                <li
                  key={item.titulo}
                  className="flex items-start gap-3 rounded-xl border border-line px-3.5 py-3"
                >
                  <span
                    className={cx(
                      "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] font-bold",
                      item.ok ? "bg-ok-bg text-ok" : "bg-warn-bg text-warn"
                    )}
                    aria-hidden
                  >
                    {item.ok ? "✓" : "!"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.2px] font-semibold text-ink">
                      {item.titulo}
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-3">{item.detalle}</span>
                  </span>
                  {!item.ok && (
                    <Link href={item.href} className={buttonClass("secondary", "sm")}>
                      {item.cta}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader
            title="Higiene de catálogos"
            description="Detectado automáticamente sobre los datos actuales de este emisor."
          />
          <CardBody className="space-y-2.5">
            {hallazgos.length === 0 ? (
              <Note tone="ok" title="Todo en orden">
                No encontramos series con tipo inválido, receptores sin RFC ni duplicados.
              </Note>
            ) : (
              hallazgos.map((h) => (
                <Note key={h.titulo} tone={h.tone} title={h.titulo}>
                  {h.texto}{" "}
                  <Link href={h.href} className="font-semibold underline">
                    Revisar
                  </Link>
                </Note>
              ))
            )}
          </CardBody>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader title="De un vistazo" />
          <CardBody className="py-1">
            <Dato etiqueta="Régimen fiscal" valor={emisor.Regimen} />
            <Dato etiqueta="Lugar de expedición" valor={emisor.LugarExp} mono />
            <Dato
              etiqueta="Vigencia del CSD"
              valor={
                tieneCsd
                  ? `${formatoFecha(emisor.VigenciaCert)}${dias !== null ? ` (${dias} días)` : ""}`
                  : "Sin certificado"
              }
            />
            <Dato etiqueta="Series registradas" valor={String(series.length)} />
            <Dato etiqueta="Folio inicial más alto" valor={String(folioMasAlto)} mono />
            <Dato etiqueta="Receptores" valor={String(receptores.length)} />
            <Dato etiqueta="Diseños de PDF" valor={String(configs.length)} />
          </CardBody>
        </Card>

        <EstatusEmisorCard rfc={emisor.Rfc} estatus={emisor.Estatus} />

        {porTipo.length > 0 && (
          <Card>
            <CardHeader title="Series por tipo de comprobante" />
            <CardBody className="flex flex-wrap gap-2">
              {porTipo.map((t) => (
                <Pill key={t.tipo} tone={tipoSerie(t.tipo).tone}>
                  {t.label} · {t.total}
                </Pill>
              ))}
              {seriesTipoInvalido.length > 0 && (
                <Pill tone="warn">Inválidas · {seriesTipoInvalido.length}</Pill>
              )}
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function Dato({
  etiqueta,
  valor,
  mono,
}: {
  etiqueta: string;
  valor: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-dashed border-line-2 py-2.5 last:border-0">
      <span className="text-[13px] text-ink-3">{etiqueta}</span>
      <span className={cx("text-[13px] font-semibold text-ink", mono && "font-mono")}>
        {valor || "—"}
      </span>
    </div>
  );
}
