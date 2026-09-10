"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CopyButton,
  Field,
  FieldError,
  Input,
  Note,
  Select,
} from "@/components/ui";
import { buttonClass } from "@/components/ui/styles";
import { ConceptoEditor } from "@/components/facturas/ConceptoEditor";
import { FORMAS_PAGO, METODOS_PAGO } from "@/lib/catalogosSat";
import { money } from "@/lib/cfdi";
import { emisorHref } from "@/lib/emisorNav";
import { calcularTotales, CONCEPTO_VACIO, problemasDeConceptos } from "@/lib/facturaNueva";
import type { AutofacturaCreada } from "@/lib/autofacturasEmisor";
import { formatoFechaLarga } from "@/lib/autofacturaShared";
import type { Serie } from "@/lib/series";
import type { ConceptoInput } from "@/lib/timbrado";

/**
 * Crear una autofactura sin punto de venta integrado: el emisor captura la
 * venta aquí y obtiene el QR/enlace para dárselo al comprador. Es el mismo
 * armado de conceptos del asistente de nueva factura; lo que no se captura
 * es el receptor, porque eso lo pone el comprador en la página pública.
 */
export function NuevaAutofacturaForm({ rfc, series }: { rfc: string; series: Serie[] }) {
  const seriesIngreso = useMemo(() => series.filter((s) => s.Tipo === "I"), [series]);

  const [serie, setSerie] = useState(seriesIngreso[0]?.Nombre ?? "");
  const [formaPago, setFormaPago] = useState<string>("01");
  const [metodoPago, setMetodoPago] = useState<string>("PUE");
  const [referencia, setReferencia] = useState("");
  const [email, setEmail] = useState("");
  const [expiraEnDias, setExpiraEnDias] = useState("");
  const [conceptos, setConceptos] = useState<ConceptoInput[]>([{ ...CONCEPTO_VACIO }]);

  const [mostrarErrores, setMostrarErrores] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creada, setCreada] = useState<AutofacturaCreada | null>(null);

  const totales = calcularTotales(conceptos);
  const problemas = problemasDeConceptos(conceptos);
  const porConcepto = conceptos.map((_, i) => {
    const prefijo = `concepto.${i}.`;
    return Object.fromEntries(
      problemas.filter((p) => p.campo.startsWith(prefijo)).map((p) => [p.campo.slice(prefijo.length), p.mensaje])
    );
  });
  const generales = problemas.filter((p) => p.campo === "conceptos");
  const emailInvalido = email.trim() !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const diasInvalidos = expiraEnDias !== "" && !(Number(expiraEnDias) >= 1 && Number(expiraEnDias) <= 365);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setMostrarErrores(true);
    setError(null);
    if (!serie || problemas.length > 0 || emailInvalido || diasInvalidos) return;

    setEnviando(true);
    try {
      const res = await fetch(`/api/empresas/${encodeURIComponent(rfc)}/autofacturas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serie,
          formaPago,
          metodoPago,
          conceptos,
          referencia: referencia.trim() || undefined,
          emailReceptor: email.trim() || undefined,
          expiraEnDias: expiraEnDias ? Number(expiraEnDias) : undefined,
        }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body) {
        setError(body?.error ?? "No se pudo crear la autofactura");
        return;
      }
      setCreada(body as AutofacturaCreada);
    } catch {
      setError("No se pudo conectar con el servidor");
    } finally {
      setEnviando(false);
    }
  }

  if (creada) {
    return <Resultado rfc={rfc} creada={creada} email={email.trim()} referencia={referencia.trim()} />;
  }

  return (
    <form onSubmit={enviar} className="space-y-4" noValidate>
      <Card>
        <CardHeader
          title="Nueva autofactura"
          description="Captura la venta y entrega el QR o el enlace al comprador: él pone sus datos fiscales y la factura se timbra sola. El timbre se consume hasta ese momento."
        />
        <CardBody className="space-y-4">
          {seriesIngreso.length === 0 && (
            <Note tone="warn" title="Este emisor no tiene series de ingreso">
              Crea una en{" "}
              <Link href={emisorHref(rfc, "series")} className="underline">
                Series y folios
              </Link>{" "}
              antes de generar autofacturas.
            </Note>
          )}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Serie" hint="El folio se asigna cuando el comprador factura.">
              <Select value={serie} onChange={(e) => setSerie(e.target.value)} aria-invalid={mostrarErrores && !serie}>
                <option value="">Elige una serie</option>
                {seriesIngreso.map((s) => (
                  <option key={s.Nombre} value={s.Nombre}>
                    {s.Nombre}
                  </option>
                ))}
              </Select>
              <FieldError mensaje={mostrarErrores && !serie ? "Elige la serie del comprobante." : undefined} />
            </Field>
            <Field label="Forma de pago">
              <Select value={formaPago} onChange={(e) => setFormaPago(e.target.value)}>
                {FORMAS_PAGO.map((f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Método de pago">
              <Select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                {METODOS_PAGO.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Field label="Referencia" hint="Opcional. Ticket o nota de venta, para reconocerla en la lista.">
              <Input value={referencia} onChange={(e) => setReferencia(e.target.value)} maxLength={80} placeholder="TICKET-1042" />
            </Field>
            <Field label="Correo del comprador" hint="Opcional. Si lo pones, le llega el QR y el enlace al momento.">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={mostrarErrores && emailInvalido} placeholder="cliente@correo.com" />
              <FieldError mensaje={mostrarErrores && emailInvalido ? "El correo no tiene un formato válido." : undefined} />
            </Field>
            <Field label="Vigencia (días)" hint="Vacío = hasta el último día de este mes.">
              <Input type="number" min={1} max={365} value={expiraEnDias} onChange={(e) => setExpiraEnDias(e.target.value)} aria-invalid={mostrarErrores && diasInvalidos} placeholder="fin de mes" />
              <FieldError mensaje={mostrarErrores && diasInvalidos ? "Entre 1 y 365 días." : undefined} />
            </Field>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Conceptos"
          description="Lo que compró. Los impuestos se calculan por concepto."
          action={
            <Button variant="secondary" type="button" onClick={() => setConceptos([...conceptos, { ...CONCEPTO_VACIO }])}>
              Agregar concepto
            </Button>
          }
        />
        <CardBody className="space-y-3">
          {conceptos.map((c, i) => (
            <ConceptoEditor
              key={i}
              concepto={c}
              indice={i}
              errores={porConcepto[i]}
              mostrarErrores={mostrarErrores}
              puedeEliminar={conceptos.length > 1}
              onChange={(nuevo) => setConceptos(conceptos.map((prev, idx) => (idx === i ? nuevo : prev)))}
              onRemove={() => setConceptos(conceptos.filter((_, idx) => idx !== i))}
            />
          ))}
          {mostrarErrores &&
            generales.map((p) => (
              <Note key={p.mensaje} tone="danger">
                {p.mensaje}
              </Note>
            ))}
        </CardBody>
      </Card>

      <Card>
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1 sm:min-w-64">
            <Renglon etiqueta="Subtotal" valor={money(totales.subtotal)} />
            {totales.trasladados > 0 && <Renglon etiqueta="Impuestos trasladados" valor={money(totales.trasladados)} />}
            {totales.retenidos > 0 && <Renglon etiqueta="Retenciones" valor={`− ${money(totales.retenidos)}`} />}
            <div className="flex items-baseline justify-between gap-4 border-t border-line pt-2">
              <span className="text-[13px] font-semibold text-ink">Total</span>
              <span className="font-mono text-xl font-bold tracking-tight text-ink">{money(totales.total)}</span>
            </div>
          </div>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {error && <Note tone="danger">{error}</Note>}
            <div className="flex gap-2">
              <Link href={emisorHref(rfc, "autofacturas")} className={buttonClass("secondary")}>
                Cancelar
              </Link>
              <Button type="submit" variant="primary" disabled={enviando || seriesIngreso.length === 0}>
                {enviando ? "Generando…" : "Generar QR"}
              </Button>
            </div>
          </div>
        </CardBody>
      </Card>
    </form>
  );
}

function Renglon({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="text-[12.5px] text-ink-3">{etiqueta}</span>
      <span className="font-mono text-[13px] font-semibold text-ink">{valor}</span>
    </div>
  );
}

function Resultado({
  rfc,
  creada,
  email,
  referencia,
}: {
  rfc: string;
  creada: AutofacturaCreada;
  email: string;
  referencia: string;
}) {
  const qr = `/api/publico/autofactura/${creada.Codigo}/qr`;
  return (
    <Card>
      <CardBody className="space-y-5 py-8 text-center">
        <div className="space-y-1">
          <p className="text-lg font-semibold text-ink">
            {referencia ? `Autofactura ${referencia} lista` : "Autofactura lista"}
          </p>
          <p className="text-sm text-ink-3">
            Entrégale el QR o el enlace al comprador. Tiene hasta el {formatoFechaLarga(creada.Expira)} para facturar.
          </p>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- PNG generado por el backend, tamaño fijo */}
        <img src={qr} alt="Código QR para facturar" width={264} height={264} className="mx-auto rounded-lg border border-line bg-white p-2" />
        <p className="mx-auto max-w-lg break-all font-mono text-[11.5px] text-ink-2">{creada.Url}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <CopyButton value={creada.Url} label="Copiar enlace" />
          <a href={qr} download={`qr-${referencia || creada.Codigo.slice(0, 8)}.png`} className="focus-brand inline-flex items-center rounded-lg border border-line bg-surface-2 px-2 py-1 text-[11.5px] text-ink hover:border-brand hover:text-brand">
            Descargar PNG
          </a>
        </div>
        {email && (
          <Note tone={creada.CorreoEnviado === "SI" ? "ok" : "warn"}>
            {creada.CorreoEnviado === "SI"
              ? `Le mandamos el QR y el enlace a ${email}.`
              : `No se pudo mandar el correo a ${email}: ${creada.CorreoError}. Puedes reintentarlo desde la lista.`}
          </Note>
        )}
        <div className="flex justify-center gap-2 pt-2">
          <Link href={emisorHref(rfc, "autofacturas")} className={buttonClass("secondary")}>
            Ver autofacturas
          </Link>
          <Link href={`${emisorHref(rfc, "autofacturas")}/nueva`} className={buttonClass("primary")}>
            Crear otra
          </Link>
        </div>
      </CardBody>
    </Card>
  );
}
